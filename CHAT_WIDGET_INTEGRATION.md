# Synapse Chat Widget Integration Guide

Synapse Clinical v4.1 provides a standalone, zero-dependency vanilla JavaScript widget (`widget.js`) designed to embed an interactive patient conversational assistant into any website or patient portal.

---

## 1. Quick Start: 1-Line HTML Embedding

Insert the following `<script>` tag before the closing `</body>` tag on any HTML page:

```html
<script 
  src="https://your-synapse-domain.com/widget.js" 
  data-tenant-id="DEFAULT_HOSPITAL" 
  data-api-url="https://api.your-synapse-domain.com" 
  data-lang="en" 
  data-theme="dark">
</script>
```

---

## 2. Configuration Attributes

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data-tenant-id` | `string` | `"DEFAULT_HOSPITAL"` | Identifier of the hospital organization (e.g. `DEFAULT_HOSPITAL`, `CLINIC_DHAKA`). |
| `data-api-url` | `string` | `"http://127.0.0.1:8000"` | Base URL of the Synapse FastAPI backend. |
| `data-lang` | `string` | `"en"` | Initial language preference (`"en"` for English, `"bn"` for বাংলা). |
| `data-theme` | `string` | `"dark"` | Visual color mode (`"dark"` or `"light"`). |

---

## 3. Platform-Specific Integration

### 3.1 WordPress
1. Log in to your WordPress Admin dashboard.
2. Navigate to **Appearance $\rightarrow$ Theme File Editor** (or use a plugin such as *WPCode / Insert Headers and Footers*).
3. Insert the snippet in the `footer.php` file right before `wp_footer()`:
   ```html
   <script 
     src="https://synapse.example.com/widget.js" 
     data-tenant-id="DEFAULT_HOSPITAL" 
     data-api-url="https://api.synapse.example.com" 
     data-lang="en">
   </script>
   ```
4. Save and publish.

### 3.2 Next.js (App Router)
Include the script in `app/layout.tsx` using `next/script`:

```tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="http://127.0.0.1:8000/widget.js"
          strategy="lazyOnload"
          data-tenant-id="DEFAULT_HOSPITAL"
          data-api-url="http://127.0.0.1:8000"
          data-lang="en"
        />
      </body>
    </html>
  );
}
```

### 3.3 Webflow or Wix
1. In Webflow, navigate to **Project Settings $\rightarrow$ Custom Code $\rightarrow$ Footer Code**.
2. Paste the `<script>` tag.
3. Save changes and publish your site.

---

## 4. Multi-Tenant Domain Allowlisting

To prevent unauthorized embedding or clickjacking from untrusted websites, Synapse enforces domain verification:

- In the **Tenant Management** dashboard (`/api/v1/tenants`), define the authorized domains for each hospital:
  ```json
  {
    "tenant_id": "CLINIC_DHAKA",
    "domains": ["dhakahealth.gov.bd", "portal.dhakahealth.gov.bd"]
  }
  ```
- When `widget.js` initializes a session via `POST /api/v1/patient/chat/sessions`, the backend checks the HTTP `Origin` header. Requests from unlisted origins receive HTTP `403 Forbidden`.
- Wildcard `"*"` is available for local testing and open staging environments.

---

## 5. Security & Privacy Safeguards
- **Isolated DOM Scope**: Widget styles use unique `.mp-*` CSS namespaces to avoid colliding with existing host page stylesheets.
- **Client-Side Session Storage**: Patient conversation tokens are maintained in `sessionStorage` and cleared when the browser tab closes.
- **Consent Banner**: Informs visitors that the assistant provides health guidance only and records consent before processing sensitive symptoms.
