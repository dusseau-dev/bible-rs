#!/usr/bin/env python3
"""Build compact, passage-indexed study data from pinned open sources.

The generated files contain reformatted excerpts, not copies of the upstream files.
Run explicitly when updating the source revisions; the normal site build is offline.
"""

import json
import re
import subprocess
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "site/src/lib/server/study/data"
STEP_REV = "5de0a47f35f0fc13dfe1430d104e5db8a4285f9c"
AQUIFER_REV = "35183d839b73958deca66fe4060d4dc7d4dc23de"
STEP_FILES = [
    "TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
    "TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
    "TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
]


def fetch(url: str) -> bytes:
    return subprocess.check_output(["curl", "-fsSL", "--retry", "2", url])


class Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_starttag(self, tag, _attrs):
        if tag in {"p", "li", "br"}:
            self.parts.append(" ")

    def handle_data(self, data):
        self.parts.append(data)

    def text(self):
        return re.sub(r"\s+", " ", "".join(self.parts)).strip()


def plain(html: str) -> str:
    parser = Plain()
    parser.feed(html)
    return parser.text()


def ref_parts(value: str):
    n = int(value)
    return n // 1_000_000 - 1, (n // 1_000) % 1_000, n % 1_000


def main():
    rust = (ROOT / "crates/core/src/books.rs").read_text()
    codes = re.findall(r'book!\(\s*"([A-Z0-9]+)"', rust)
    assert len(codes) == 66, "the canonical book list changed"
    by_step = {code.title(): i for i, code in enumerate(codes)}
    chapters = [defaultdict(lambda: {"notes": [], "terms": {}}) for _ in codes]

    for book in range(66):
        name = f"{book + 1:02}.content.json"
        url = (
            "https://raw.githubusercontent.com/BibleAquifer/AquiferOpenStudyNotes/"
            f"{AQUIFER_REV}/eng/json/{name}"
        )
        for article in json.loads(fetch(url)):
            spans = article.get("associations", {}).get("passage", [])
            text = plain(article.get("content", ""))
            if not spans or not text:
                continue
            for span in spans:
                first = ref_parts(span["start_ref"])
                last = ref_parts(span["end_ref"])
                if first[0] != book or last[0] != book:
                    continue
                note = {
                    "id": article["content_id"],
                    "title": article["title"],
                    "from": [first[1], first[2]],
                    "to": [last[1], last[2]],
                    "text": text[:1400],
                }
                for chapter in range(first[1], last[1] + 1):
                    chapters[book][chapter]["notes"].append(note)

    word = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)#\d+=([^\t]+)")
    unknown = set()
    for name in STEP_FILES:
        url = (
            "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/"
            f"{STEP_REV}/Translators%20Amalgamated%20OT%2BNT/{quote(name)}"
        )
        nt = name.startswith("TAGNT")
        for line in fetch(url).decode("utf-8-sig").splitlines():
            match = word.match(line)
            if not match:
                continue
            abbrev, ch, verse, editions = match.groups()
            book = by_step.get(abbrev)
            if book is None:
                unknown.add(abbrev)
                continue
            if nt and not ("N" in editions or "K" in editions):
                continue
            fields = line.split("\t")
            if len(fields) < 11:
                continue
            original = fields[1].split(" (")[0].strip()
            translit = (fields[1].split(" (", 1)[1].rstrip(")") if nt and " (" in fields[1] else fields[2] if not nt else "")
            gloss = fields[2] if nt else fields[3]
            lemma = fields[4] if nt else fields[10]
            if not original or len(original) > 60:
                continue
            terms = chapters[book][int(ch)]["terms"].setdefault(verse, [])
            terms.append([original, translit[:60], gloss[:100], lemma[:130]])
    assert not unknown, f"unknown STEPBible book codes: {sorted(unknown)}"

    OUT.mkdir(parents=True, exist_ok=True)
    count_notes = count_terms = 0
    for book, data in enumerate(chapters):
        payload = dict(sorted(data.items()))
        for chapter in payload.values():
            chapter["notes"] = list({n["id"]: n for n in chapter["notes"]}.values())
            count_notes += len(chapter["notes"])
            count_terms += sum(len(words) for words in chapter["terms"].values())
        (OUT / f"{book:02}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(f"Built {len(chapters)} books: {count_notes} indexed notes, {count_terms} tagged words")


if __name__ == "__main__":
    main()
