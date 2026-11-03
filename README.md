# 🩸 Blood Registry — NSS Blood Donation Cell

A web-based blood donor management portal developed for the **NSS Blood Donation Cell**. The application helps coordinators manage donor records and allows faculty members to view registered donors.

🔗 **GitHub Repository:** [Blood-Registry](https://github.com/sanumuhammedm06-cell/Blood-Registry)

---

## 📌 About the Project

Blood Registry is designed to make blood donor information easier to organize and access. It provides a centralized platform for maintaining donor details, including their name, blood group, phone number, department, and batch.

The portal uses role-based access to distinguish between coordinators and faculty members.

## ✨ Features

- **Donor Management** — Add and maintain blood donor records.
- **Donor Directory** — View registered donors and their details.
- **Role-Based Access** — Separate access for Coordinators and Faculty.
- **Supabase Integration** — Store and retrieve donor information from a database.
- **Responsive Interface** — A simple interface for accessing donor information.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend development |
| JavaScript | Application logic |
| CSS | Styling and layout |
| Supabase | Database and backend services |
| Git & GitHub | Version control and source code hosting |

## 👥 User Roles

### Coordinator
- Log in to the portal.
- Add new donor records.
- View donor information.

### Faculty
- Log in to the portal.
- View the registered donor directory.

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm
- A [Supabase](https://supabase.com/) project

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/sanumuhammedm06-cell/Blood-Registry.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Blood-Registry
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root and configure your Supabase connection:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local URL displayed in your terminal.

## 🗄️ Database

The application uses Supabase to store donor information.

The donor records include:

- Donor ID
- Full Name
- Blood Group
- Phone Number
- Department
- Batch
- Created At
- Updated At

## 🔐 Security

- Supabase credentials are configured through environment variables.
- Do not commit private keys, service-role keys, or database passwords.
- Configure appropriate Row Level Security (RLS) policies in Supabase before using the application with real donor data.

## 🎯 Project Objective

The objective of Blood Registry is to simplify donor record management for the NSS Blood Donation Cell and provide an organized way to access donor information when needed.

## 👨‍💻 Developer

**Sanu Muhammed M**

GitHub: [@sanumuhammedm06-cell](https://github.com/sanumuhammedm06-cell)

---

*Developed as a project for the NSS Blood Donation Cell.*
