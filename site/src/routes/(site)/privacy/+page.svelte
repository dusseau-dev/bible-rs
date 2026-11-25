<script lang="ts">
	import { resolve } from '$app/paths';
	import { SITE_NAME, SITE_URL } from '#lib/config.js';
	import Doc from '#lib/Doc.svelte';

	const title = `Privacy policy | ${SITE_NAME}`;
	const description =
		'This private web reader uses owner authentication and optional study services. Notes, highlights, and imported translations stay on your device.';
	const url = `${SITE_URL}/privacy`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
</svelte:head>

<Doc heading="Privacy policy" meta="Updated 23 November 2026. Covers this private web reader and the unchanged native Bible apps.">
	<p class="lede">
		This website is a private reader for one owner. Sign-in and optional study requests use the
		server. Your saved highlights, notes, bookmarks, and imported translations stay in your browser.
		The native apps' behavior is described separately below.
	</p>

	<h2>What stays on your device</h2>
	<p>
		The app saves your highlights, notes, bookmarks, reading position, history and settings in a
		file inside it on your iPhone, iPad or Mac. They leave it only when you export or share them.
		On iPhone and iPad, your device's iCloud or computer backups include them, as they do for any
		app. Translations you import on the Mac stay on your Mac.
	</p>

	<h2>When the app uses the internet</h2>
	<p>
		On iPhone and iPad, never. The seven translations are inside the app, and it makes no network
		connections.
	</p>
	<p>The Mac app goes online for two things only:</p>
	<ul>
		<li>
			Checking for updates, which downloads the list of releases from GitHub. The request carries
			only the app's version, and GitHub sees your IP address, as with any download.
		</li>
		<li>
			Online translations you add yourself: the ESV, NLT, NET, or a Bible from API.Bible. The app
			asks that publisher's server directly for the chapters you open, with your API key where one
			is needed. For API.Bible it also reports which passages were shown, with random identifiers,
			as API.Bible's terms require. Each publisher's own privacy policy covers those requests.
		</li>
	</ul>

	<h2>Sharing and crash reports</h2>
	<p>
		When you copy or share a verse, or export your notes, it goes only where you send it. Apple
		passes crash reports to developers only if you've turned on sharing with app developers in your
		device's settings. They describe the crash, not your notes or highlights.
	</p>

	<h2>Private website sign-in</h2>
	<p>
		There is no public signup. The server checks the owner's email and password against a salted
		password hash, then sets an HttpOnly session cookie that expires after 12 hours. Upstash Redis
		stores a hashed session-token lookup key, owner email, expiry, and password-version fingerprint.
		Sign-out deletes the server session. Changing the configured password hash invalidates existing
		sessions. Login attempt counters use hashed addresses and expire after 15 minutes.
	</p>
	<p>
		This private fork does not enable page-view analytics. Hosting infrastructure receives normal
		request details such as IP address and URL. Fonts are self-hosted; the landing page's GitHub
		download counter makes a request to GitHub. Links to outside sources use those sites' policies.
	</p>
	<h2>Study requests</h2>
	<p>
		Opening passage study sends the passage reference to this server. When enabled, additional
		sources and testimonial links are searched through Exa, video metadata through YouTube, and
		publication metadata through OpenAlex. AI explanations send the selected passage, surrounding
		text, cited evidence, and any question you type to the configured CheaperInference or OpenAI
		provider. Saved notes and your reading library are not included. Per-request API keys, when
		used, are sent to the server but are not saved in your library.
	</p>
	<p>
		Redis also stores request-limit counters and successful search metadata for up to seven days.
		Study counters identify a request address using a daily salted hash. The app does not fetch
		paper bodies or video transcripts. Reviewed links can remain visible when discovery fails.
	</p>
	<h2>Online translations and local storage</h2>
	<p>
		In the web reader, the NLT comes live from Tyndale. When you choose it, the reader asks this
		site for the chapter you're reading, and the site asks Tyndale's NLT API for it with the
		site's own key. Tyndale sees which chapter the site asked for, but not your browser or your IP
		address. Authenticated responses are not stored in a public CDN cache. To keep the service from being overused, the site counts how many
		chapters each IP address asks for. The counts are kept in memory and deleted about a day after
		that address's first request. Your browser keeps only the chapter on screen, and only until
		you move on.
	</p>
	<p>
		The private web reader requires an online session and removes its former offline page cache.
		Its service worker saves only a public reconnect screen for use without a connection; it does
		not cache private pages, Bible translations, or study responses for offline access.
		Sign-out preserves browser-local notes, imports, settings, and backups; it does not encrypt or
		remotely erase them. Use a trusted device and export your library before clearing browser data.
	</p>

	<h2>Changes and questions</h2>
	<p>
		Changes to this policy are published on this page with a new date. Questions are welcome on the
		<a href={resolve('/(site)/support')}>support page</a>.
	</p>

</Doc>
