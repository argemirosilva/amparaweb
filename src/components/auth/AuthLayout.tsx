import amparaLogo from "@/assets/ampara-logo.png";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - decorative gradient */}
      <div className="hidden lg:flex lg:w-[45%] ampara-panel-bg items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative blurred circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-16 left-16 w-72 h-72 rounded-full bg-ampara-magenta/15 blur-3xl" />
          <div className="absolute bottom-24 right-12 w-56 h-56 rounded-full bg-ampara-cyan/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-ampara-purple/10 blur-2xl" />
        </div>

        <div className="relative text-center max-w-sm">
          <img
            src={amparaLogo}
            alt="AMPARA"
            className="w-28 h-28 mx-auto mb-8 object-contain drop-shadow-xl"
          />
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4 leading-tight">
            AMPARA Mulher
          </h1>
          <p className="text-primary-foreground/75 text-lg leading-relaxed">
            Sua rede de proteção e acolhimento. Aqui você está segura.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img
              src={amparaLogo}
              alt="AMPARA"
              className="w-16 h-16 mx-auto mb-3 object-contain"
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
