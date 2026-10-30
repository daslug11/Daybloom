import { LegalPage, Pending } from './PublicLayout';
import { useDocumentTitle } from './useDocumentTitle';

export default function Privacy() {
  useDocumentTitle('Privacy Policy · Daybloom');
  return (
    <LegalPage title="Privacy Policy" updated={<Pending>date</Pending>}>
      <p>
        This policy explains what Daybloom (daybloom.online, run by <Pending>company or your name</Pending>) collects and why. Short version: we store what you
        put in Daybloom so it can sync across your devices, we send the minimum needed to our AI provider only when you press a ✨ button or talk to Atlas, and you
        can export or delete everything at any time.
      </p>
      <h2>1. What we store</h2>
      <ul>
        <li>Account details: email address, hashed password (handled by our auth provider), name, time zone and preferences.</li>
        <li>Your content: notes, tasks, habits and check-ins, goals, mood check-ins, focus sessions, saved calendar links, and your conversation with Atlas.</li>
        <li>AI usage records: which AI feature you used, when, and token counts/estimated cost — used to enforce daily limits and budgets.</li>
      </ul>
      <h2>2. Where it’s stored</h2>
      <p>
        Data is stored with Supabase (database and authentication) in <Pending>region</Pending>, and the app is hosted on Vercel. Each table is protected so only
        your account can read or change your rows.
      </p>
      <h2>3. AI processing</h2>
      <p>
        When you use an AI feature or Atlas, the relevant part of your data (for example, the note you asked to summarise, or a short list of today’s tasks) is
        sent to Anthropic’s API to generate the response. AI never runs in the background — only when you ask.{' '}
        <Pending>Check and describe Anthropic’s current data retention terms for API customers</Pending>
      </p>
      <h2>4. Calendar feeds</h2>
      <p>
        If you turn on sync for a calendar link, our server fetches that feed to show events in your Planner. Feed contents are cached in memory for up to 10
        minutes and are not stored in our database. Secret calendar addresses are stored with your account like your other data.
      </p>
      <h2>5. Voice</h2>
      <p>
        Voice capture and voice mode use your browser’s speech recognition and speech synthesis. Depending on your browser, speech may be processed by the browser
        vendor (for example, Google in Chrome). Daybloom receives only the resulting text.
      </p>
      <h2>6. Cookies and local storage</h2>
      <p>We use your browser’s storage to keep you signed in and to remember small preferences (theme, sidebar). No advertising or tracking cookies.</p>
      <h2>7. Your rights</h2>
      <ul>
        <li>Export: Settings → “Export everything” downloads everything as JSON.</li>
        <li>Delete: Settings → “Delete account” permanently deletes your account and data.</li>
        <li>
          Questions or requests: <a href="mailto:hello@daybloom.online" className="link">hello@daybloom.online</a>.{' '}
          <Pending>Add any rights required in your jurisdiction, e.g. GDPR / UK GDPR</Pending>
        </li>
      </ul>
      <h2>8. Retention</h2>
      <p>
        We keep your data while your account exists. When you delete your account it is removed from our database immediately; backups expire within{' '}
        <Pending>X</Pending> days.
      </p>
      <h2>9. Changes</h2>
      <p>We’ll update this page and the date above if anything changes.</p>
    </LegalPage>
  );
}
