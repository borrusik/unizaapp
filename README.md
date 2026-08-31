# 🎓 UNIZA Student

**Modern, fast, and secure web application for students of the University of Žilina (UNIZA).**

This project was born out of the need to unify the two most important student systems into a single, clean, and modern interface. The application seamlessly combines the functionality of the **Vzdelávanie portal** (schedule, grades, subjects) and the **Catering and accommodation system** (daily menu, ISIC card balance).

---

## 🌟 Main Features

*   **📅 Schedule** — A clear list of lectures, practicals, and labs divided by day. No complex tables, just what's ahead of you today.
*   **🎓 Grades and Subjects** — Quick overview of evaluations, earned credits (ECTS), and grade point average, including previous academic years exposed by AIVS.
*   **🍔 Canteen (Strava)** — Public menus for multiple days and every WebKredit canteen/serving point, plus authenticated ISIC balance and transaction history.
*   **📱 PWA (Progressive Web App)** — Add the app to your phone's home screen (iOS and Android) and use it like a native application.
*   **🌍 Multilingual** — Slovak, English, Ukrainian, and Russian interfaces.
*   **🌙 Dark Mode** — The interface automatically adapts to your device's system appearance settings.

## 🔐 Privacy and Security

The security of your sensitive data is the top priority. The application is designed to protect your information:

1.  **Encrypted automatic sign-in:** Credentials are never stored in a database or in plaintext. When `UNIZA_SESSION_SECRET` is configured, the email and password are encrypted with authenticated AES-256-GCM encryption and kept for up to 30 days in an `HttpOnly`, `Secure`, `SameSite=Strict` browser cookie. Without this secret, only the current upstream session is retained.
2.  **Direct connection:** The server connects only to allow-listed official UNIZA hosts. Subject and Moodle links are validated before they can be fetched or opened.
3.  **Private student data:** Grades, schedules, profile details, balances, and transaction history are held in the current in-memory UI session and are not persisted in `localStorage`.
4.  **Modern protection:** The codebase includes a nonce-based CSP, HSTS, strict cookie settings, request timeouts, response-size limits, and login rate limiting.
5.  **Google Analytics:** The project uses anonymized traffic analytics without intentionally sending student records or login fields.

## Configuration

Create `.env.local` for local development and configure the same variable in the production hosting environment:

```dotenv
UNIZA_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Use a cryptographically random value and do not commit it. Rotating the value safely invalidates all saved automatic-login cookies. The repository includes `.env.example` as a template.

The app integrates with these official systems and public resources:

* **AIVS / Vzdelávanie** for subjects, grades, profile data, schedules, and the official list of available academic years.
* **Moodle** through the per-subject links issued by AIVS; direct Moodle login is intentionally not attempted.
* **WebKredit** for the authenticated balance and transaction history, and its public menu API for canteen menus, allergens, closures, and serving-point selection.
* **Menza UNIZA** as the human-readable official menu fallback when WebKredit is unavailable.
* **UNIZA academic calendar, campus map, and Helpdesk** through verified official links in the profile.

## 🛠 Built With

This application is built using a modern technology stack:
*   **Next.js** (App Router & Server Actions)
*   **React**
*   **TypeScript**
*   **Cheerio & Fetch API** (for fetching data from UNIZA portals)
*   **Vercel** (hosting platform)

---
*Developed with ❤️ for UNIZA students.*
