import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Mic,
  UserCircle,
  Settings,
  LogOut,
  Search,
  Headset,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import amparaLogo from "@/assets/ampara-circle-logo.png";
import orizonLogo from "@/assets/orizon-tech-logo-2.png";

const menuItems = [
  { title: "Dashboard", url: "/home", icon: LayoutDashboard },
  { title: "Gravações", url: "/gravacoes", icon: Mic },
  { title: "Pesquisar Parceiro", url: "/busca-perfil", icon: Search },
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      {/* Logo area with organic half-circle */}
      <div className="relative p-4 pb-6 overflow-hidden">
        {/* Large organic circles in background */}
        <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full opacity-[0.12]" style={{ background: "linear-gradient(135deg, hsl(280,60%,48%), hsl(320,70%,50%))" }} />
        <div className="absolute -top-8 -right-12 w-28 h-28 rounded-full opacity-[0.08]" style={{ background: "hsl(320, 70%, 55%)" }} />
        <div className="absolute top-12 -left-6 w-16 h-16 rounded-full opacity-[0.06]" style={{ background: "hsl(280, 50%, 60%)" }} />

        {/* Sparkle dots */}
        <div className="absolute top-4 right-6 w-1.5 h-1.5 rounded-full opacity-20 animate-pulse" style={{ background: "hsl(320, 70%, 60%)" }} />
        <div className="absolute top-10 right-3 w-1 h-1 rounded-full opacity-15 animate-pulse" style={{ background: "hsl(280, 60%, 55%)", animationDelay: "0.7s" }} />

        {/* Logo inside half-circle accent */}
        <div className="relative flex items-center gap-3">
          <div className="relative">
            {/* Half-circle backdrop */}
            <div className="absolute -inset-2 rounded-full" style={{ background: "linear-gradient(135deg, hsla(280,60%,48%,0.15), hsla(320,70%,50%,0.1))" }} />
            <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[hsla(280,60%,48%,0.2)]">
              <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
            </div>
          </div>
          <span className="font-display font-bold text-sidebar-foreground text-lg group-data-[collapsible=icon]:hidden">
            AMPARA
          </span>
        </div>
      </div>

      {/* Curved divider */}
      <div className="relative h-3 -mt-1">
        <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,0 C60,12 140,12 200,0 L200,12 L0,12 Z" fill="hsl(280, 60%, 48%)" fillOpacity="0.06" />
        </svg>
      </div>

      <SidebarContent className="px-2">
        {/* Floating organic circles */}
        <div className="absolute top-1/3 -right-8 w-24 h-24 rounded-full opacity-[0.04]" style={{ background: "hsl(320, 70%, 50%)" }} />
        <div className="absolute bottom-1/4 -left-6 w-16 h-16 rounded-full opacity-[0.05]" style={{ background: "hsl(280, 60%, 55%)" }} />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      activeClassName="text-sidebar-primary font-medium ampara-sidebar-active"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                        <item.icon className="w-[18px] h-[18px]" />
                      </div>
                      <span className="group-data-[collapsible=icon]:hidden text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Curved divider above footer */}
        <div className="relative h-3">
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,12 C60,0 140,0 200,12 L200,0 L0,0 Z" fill="hsl(320, 70%, 55%)" fillOpacity="0.04" />
          </svg>
        </div>
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton onClick={() => navigate("/support")} className="w-fit rounded-xl">
                    <Headset className="w-5 h-5 shrink-0 text-sidebar-foreground/50" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Suporte Técnico</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="rounded-xl">
              <LogOut className="w-5 h-5 shrink-0 text-sidebar-foreground/50" />
              <span className="group-data-[collapsible=icon]:hidden text-sidebar-foreground/50">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Desenvolvido por */}
        <div className="group-data-[collapsible=icon]:hidden border-t border-sidebar-border pt-3 pb-2 px-3 flex items-center justify-center gap-2">
          <span className="text-[10px] text-sidebar-foreground/40 tracking-wide whitespace-nowrap">Desenvolvido por</span>
          <img src={orizonLogo} alt="Orizon Tech" className="h-6 object-contain opacity-60" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
