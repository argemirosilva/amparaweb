import amparaLogo from "@/assets/ampara-logo.png";

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-1/2 ampara-gradient-bg items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-32 right-16 w-48 h-48 rounded-full bg-primary-foreground/15 blur-2xl" />
        </div>
        <div className="relative text-center max-w-md">
          <img src={amparaLogo} alt="AMPARA" className="w-32 h-32 mx-auto mb-6 object-contain drop-shadow-lg" />
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4">
            AMPARA Mulher
          </h1>
          <p className="text-primary-foreground/80 text-lg leading-relaxed">
            Sua rede de proteção e acolhimento. Aqui você está segura.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={amparaLogo} alt="AMPARA" className="w-20 h-20 mx-auto mb-3 object-contain" />
            <h2 className="text-2xl font-display font-bold text-foreground">AMPARA Mulher</h2>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground">{title}</h2>
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
