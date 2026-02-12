import amparaLogo from "@/assets/ampara-logo.png";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Form panel - full width */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src={amparaLogo}
              alt="AMPARA"
              className="w-48 h-48 mx-auto mb-3 object-contain"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-2 text-muted-foreground text-sm">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
