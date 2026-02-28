# 🎓 UNIZA Student

**Modern, fast, and secure web application for students of the University of Žilina (UNIZA).**

This project was born out of the need to unify the two most important student systems into a single, clean, and modern interface. The application seamlessly combines the functionality of the **Vzdelávanie portal** (schedule, grades, subjects) and the **Catering and accommodation system** (daily menu, ISIC card balance).

---

## 🌟 Main Features

*   **📅 Schedule** — A clear list of lectures, practicals, and labs divided by day. No complex tables, just what's ahead of you today.
*   **🎓 Grades and Subjects** — Quick overview of your evaluations, earned credits (ECTS), and grade point average.
*   **🍔 Canteen (Strava)** — Current daily menu, ISIC card credit balance, and your transaction history in the university canteen.
*   **📱 PWA (Progressive Web App)** — Add the app to your phone's home screen (iOS and Android) and use it like a native application.
*   **🌍 Multilingual** — Full support for both Slovak and English languages.
*   **🌙 Dark Mode** — The interface automatically adapts to your device's system appearance settings.

## 🔐 Privacy and Security

The security of your sensitive data is the top priority. The application is designed to protect your information:

1.  **No Password Storage:** Your login credentials are **never** stored in any external database. They are only used for one-time authentication against official university servers.
2.  **Direct Connection:** The application acts as an intermediary (scraper) – it fetches data directly from the official UNIZA portals and returns them to you in a modern design.
3.  **Modern Protection:** The codebase includes strict security headers (CSP with nonce, HSTS, XSS protection) and robust defense against automated bot attacks.
4.  **Google Analytics:** The project utilizes anonymized traffic analytics without collecting personal data (IP addresses are masked).

## 🛠 Built With

This application is built using a modern technology stack:
*   **Next.js** (App Router & Server Actions)
*   **React**
*   **TypeScript**
*   **Cheerio & Fetch API** (for fetching data from UNIZA portals)
*   **Vercel** (hosting platform)

---
*Developed with ❤️ for UNIZA students.*
