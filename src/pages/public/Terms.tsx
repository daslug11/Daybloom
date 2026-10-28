import { Link } from 'react-router-dom';
import { LegalPage } from './PublicLayout';

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="[DATE]">
      <p>
        These terms apply to Daybloom at daybloom.online, run by [COMPANY / YOUR NAME] (“we”). By creating an account you agree to them. If you don’t agree,
        please don’t use Daybloom.
      </p>
      <h2>1. Your account</h2>
      <ul>
        <li>You need a valid email address and must be at least [16] years old.</li>
        <li>Keep your password safe. You’re responsible for activity on your account.</li>
        <li>You can delete your account at any time in Settings; this permanently deletes your data.</li>
      </ul>
      <h2>2. Your content</h2>
      <p>
        Notes, tasks, habits, goals and other things you add stay yours. You give us permission to store and process them only to run Daybloom for you —
        including sending the relevant parts to our AI provider when you use a ✨ AI feature or Atlas (see the <Link to="/privacy" className="link">Privacy Policy</Link>).
      </p>
      <h2>3. AI features</h2>
      <ul>
        <li>AI features have a daily allowance per account and may be paused for everyone when our monthly budget is reached.</li>
        <li>AI output can be wrong. Check anything important before relying on it. Atlas asks before deleting things, but you’re responsible for changes you approve.</li>
        <li>Daybloom is not a medical, legal or financial service. The mood “Reflect” feature is not therapy or diagnosis.</li>
      </ul>
      <h2>4. Acceptable use</h2>
      <p>Don’t misuse Daybloom: no attempts to access other people’s data, overload or reverse-engineer the service, or use it for anything illegal.</p>
      <h2>5. The service</h2>
      <p>
        Daybloom is provided “as is”. We work to keep it available and your data safe, but can’t guarantee it will be uninterrupted or error-free. Keep your own
        copy of anything critical — you can export all your data from Settings at any time.
      </p>
      <h2>6. Price</h2>
      <p>Daybloom is currently free. If that changes, we’ll tell you in advance and you’ll be able to export and delete your data.</p>
      <h2>7. Ending things</h2>
      <p>You can stop using Daybloom and delete your account whenever you like. We may suspend accounts that break these terms.</p>
      <h2>8. Liability</h2>
      <p>[LIMITATION OF LIABILITY CLAUSE APPROPRIATE TO YOUR JURISDICTION]</p>
      <h2>9. Changes and contact</h2>
      <p>
        We’ll post changes here and update the date above. Questions: <a href="mailto:hello@daybloom.online" className="link">hello@daybloom.online</a>. Governing law:
        [JURISDICTION].
      </p>
    </LegalPage>
  );
}
