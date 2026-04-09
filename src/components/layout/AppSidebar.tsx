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
      {/* Logo area with organic curve */}
      <div className="relative p-4 flex items-center gap-3 overflow-hidden">
        {/* Decorative blob behind logo */}
        <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full opacity-[0.08]" style={{ background: "hsl(320, 70%, 55%)" }} />
        <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full opacity-[0.05]" style={{ background: "hsl(280, 60%, 50%)" }} />
        <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
          <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover invert mix-blend-screen" />
        </div>
        <span className="font-display font-bold text-white text-lg group-data-[collapsible=icon]:hidden relative">
          AMPARA
        </span>
      </div>

      {/* Curved divider */}
      <div className="relative h-4 -mt-1">
        <svg viewBox="0 0 200 16" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,0 C60,16 140,16 200,0 L200,16 L0,16 Z" fill="hsl(320, 70%, 55%)" fillOpacity="0.06" />
        </svg>
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="text-sidebar-primary font-medium"
                      style={({ isActive }: { isActive: boolean }) =>
                        isActive
                          ? { background: "linear-gradient(135deg, hsla(280,60%,50%,0.15), hsla(320,70%,55%,0.1))" }
                          : undefined
                      }
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200">
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
                    <Headset className="w-5 h-5 shrink-0 text-sidebar-foreground/70" />
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
              <LogOut className="w-5 h-5 shrink-0 text-sidebar-foreground/70" />
              <span className="group-data-[collapsible=icon]:hidden text-sidebar-foreground/70">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Desenvolvido por */}
        <div className="group-data-[collapsible=icon]:hidden border-t border-sidebar-border pt-3 pb-2 px-3 flex items-center justify-center gap-2">
          <span className="text-[10px] text-sidebar-foreground/40 tracking-wide whitespace-nowrap">Desenvolvido por</span>
          <img src={orizonLogo} alt="Orizon Tech" className="h-6 object-contain mix-blend-screen" style={{ filter: "invert(1) hue-rotate(180deg)" }} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
