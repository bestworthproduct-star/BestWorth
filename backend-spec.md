# SDLC & System Architecture — Bestworth Backend Transition

## 1. Requirements Analysis
Based on the existing UI, the system requires the following dynamic data points:
- **Products:** Categories (nails, screws, etc.), images, names, descriptions, and "Featured" status.
- **Management:** Team names, roles, and portrait images.
- **Contact:** Secure capture of name, email, company, and message.
- **Auth:** Secure admin login to manage the above.

## 2. System Architecture
- **Backend:** Node.js + Express.js
- **Database:** MongoDB (using Mongoose for modeling).
- **Authentication:** JWT (JSON Web Tokens) for stateless session management.
- **File Storage:** Cloudinary or local uploads for product/team images.

## 3. Data Models (MongoDB Schemas)

### User (Admin)
- `username`: String (Unique)
- `password`: String (Hashed)

### Product
- `name`: String
- `category`: String (Enum: nails, screws, bolts, building)
- `description`: String
- `image`: String (URL)
- `featured`: Boolean
- `createdAt`: Date

### TeamMember
- `name`: String
- `role`: String
- `image`: String (URL)
- `order`: Number (for display sequence)

### Inquiry
- `name`: String
- `email`: String
- `company`: String
- `message`: String
- `status`: String (Enum: new, read, archived)
- `createdAt`: Date

## 4. Proposed UI Integration
- `/login`: Minimalist charcoal background with brass accents, matching the site's footer style.
- `/admin`: Sidebar-driven dashboard matching the site's main navigation, with data tables for Products and Inquiries.
