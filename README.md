# Antigravity Proxy https://yuunano.github.io/Proxy

Antigravity Proxy is a simple, lightweight web proxy service designed for educational purposes and technical verification. It features a minimalist dark-themed UI and a basic Node.js backend structure.

> [!WARNING]
> **Disclaimer**: This project is intended strictly for **educational and technical verification purposes** (e.g., studying HTTP protocols, proxy behaviors, and network bypassing techniques in a controlled environment).
>
> - **Do not use this software for illegal activities.**
> - **Do not use this software to bypass copyright protections or access restricted content without authorization.**
> - The authors and contributors are not responsible for any misuse of this software.

## Features

- **Minimalist Design**: Dark mode, distraction-free interface.
- **Frontend**: Static HTML/JS intended for GitHub Pages deployment.
- **Backend**: Basic Node.js proxy server (source code provided).
- **Lightweight**: Optimized for speed and low resource usage.

## Setup & Usage

### Frontend (GitHub Pages)
The content of the `docs/` folder is designed to be served via GitHub Pages.

1. **Serverless Mode (Default)**:
   - Select "Translate (Public)" or "Wayback (Archive)" from the dropdown.
   - Enter a URL and click GO.
   - **No backend required**. Uses Google Translate or Wayback Machine to display content.

2. **Custom Mode**:
   - Select "Custom Server".
   - Requires a running backend (see below).
   - Suitable for developers customizing the proxy logic.

### Backend (Local / VPS)
*Optional: Only needed for "Custom Server" mode.*

To run the proxy server locally:
1. Navigate to the `server/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node proxy.js
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

