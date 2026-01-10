# 🚚 MilesConnect - Fleet Tracking System

A comprehensive real-time fleet tracking and management system built with Next.js, Supabase, and Mapbox. Track your vehicles, manage drivers, monitor shipments, and optimize fleet operations all in one place.

## ✨ Features

- **Real-time Fleet Tracking** - Monitor vehicle locations on an interactive map
- **Driver Management** - Add, update, and manage driver profiles and statuses
- **Vehicle Management** - Track vehicle information, status, and locations
- **Shipment Tracking** - Create and monitor shipments with real-time status updates
- **Live Location Tracking** - Dedicated driver app with real-time GPS tracking
- **Route Simulation** - Test and simulate delivery routes
- **Public Tracking** - Share shipment tracking links with customers
- **Responsive Design** - Works seamlessly on desktop and mobile devices

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Maps**: [Mapbox GL JS](https://www.mapbox.com/)
- **UI Components**: Radix UI
- **Icons**: Lucide React

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- **Git** - [Download](https://git-scm.com/)
- **Supabase Account** - [Sign up](https://supabase.com/)
- **Mapbox Account** - [Sign up](https://www.mapbox.com/)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/itanishqshelar/milesconnect-demo.git
cd milesconnect-demo
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 3. Set Up Supabase

1. Create a new project in [Supabase](https://supabase.com/)
2. Go to the SQL Editor in your Supabase dashboard
3. Copy the contents of `supabase-schema.sql` and run it in the SQL Editor
4. This will create all necessary tables: `drivers`, `vehicles`, and `shipments`
5. Get your project credentials:
   - Go to Settings > API
   - Copy the `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - Copy the `anon public` key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

### 4. Set Up Mapbox

1. Create a free account at [Mapbox](https://www.mapbox.com/)
2. Go to your Account Dashboard
3. Create a new access token or use the default public token
4. Copy your access token (NEXT_PUBLIC_MAPBOX_TOKEN)

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Mapbox Configuration
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
```

⚠️ **Important**: Never commit your `.env.local` file. It's already included in `.gitignore`.

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📱 Application Structure

### Admin Dashboard (`/dashboard`)

- **Fleet Map** - View all vehicles on an interactive map
- **Vehicles** - Manage vehicle inventory and status
- **Drivers** - Manage driver profiles and assignments
- **Shipments** - Create and monitor shipments

### Driver App (`/driver`)

- **Login** - Driver authentication
- **Dashboard** - View assigned shipments
- **Shipment Details** - Real-time tracking and status updates
- **Live Location** - Background GPS tracking

### Public Features

- **Tracking Page** (`/track`) - Public shipment tracking
- **Simulation** - Test route functionality (`/api/simulate`)

## 🏗️ Project Structure

```
milesconnect/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── (dashboard)/       # Admin dashboard routes
│   │   ├── api/               # API routes
│   │   ├── driver/            # Driver app routes
│   │   ├── login/             # Login pages
│   │   └── track/             # Public tracking page
│   ├── components/            # React components
│   │   ├── ui/               # Reusable UI components
│   │   ├── drivers/          # Driver-specific components
│   │   ├── vehicles/         # Vehicle-specific components
│   │   └── shipments/        # Shipment-specific components
│   ├── lib/                  # Utility functions and configs
│   │   ├── actions/          # Server actions
│   │   ├── supabase/         # Supabase client configs
│   │   └── types/            # TypeScript type definitions
│   └── hooks/                # Custom React hooks
├── public/                   # Static assets
└── supabase-schema.sql       # Database schema
```

## 🔑 Key Features Explained

### Real-time Tracking

The application uses Supabase Realtime to provide live updates for vehicle locations and shipment statuses. Changes in the database are instantly reflected in the UI.

### Location Services

- Uses the browser's Geolocation API for driver location tracking
- Wake Lock API keeps the screen active during tracking
- Automatic location updates every 5 seconds

### Map Integration

- Interactive Mapbox maps with custom markers
- Route visualization with polylines
- Automatic viewport adjustment
- Vehicle clustering for better performance

## 🧪 Testing

Build the project to check for TypeScript errors:

```bash
npm run build
```

Run the linter:

```bash
npm run lint
```

## 🌐 Deployment

### Deploy on Vercel

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/itanishqshelar/milesconnect-demo)

### Other Platforms

You can also deploy on:

- [Netlify](https://www.netlify.com/)
- [Railway](https://railway.app/)
- [AWS Amplify](https://aws.amazon.com/amplify/)

## 📚 Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

### Supabase Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

### Mapbox Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [React Map GL Documentation](https://visgl.github.io/react-map-gl/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Issues

If you encounter any issues or have questions, please [open an issue](https://github.com/itanishqshelar/milesconnect-demo/issues) on GitHub.

## 👤 Author

**Tanishq Shelar**

- GitHub: [@itanishqshelar](https://github.com/itanishqshelar)

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- Maps by [Mapbox](https://www.mapbox.com/)
- UI components from [Radix UI](https://www.radix-ui.com/)
