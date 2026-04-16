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
  Shield,
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
import amparaLogo from "@/assets/ampara-circle-logo-color.png";
import orizonLogo from "@/assets/orizon-tech-logo-final.png";

const menuItems = [
  { title: "Dashboard", url: "/home", icon: LayoutDashboard },
  { title: "Gravações", url: "/gravacoes", icon: Mic },
  { title: "Pesquisar", url: "/busca-perfil", icon: Search },
  { title: "Força de Segurança", url: "/campo/busca", icon: Shield },
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Config.", url: "/configuracoes", icon: Settings },
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
      {/* Logo */}
      <div className="pt-4 pb-6 px-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-border">
          <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
        </div>
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
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
                      activeClassName="text-primary font-medium ampara-sidebar-active"
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

      <SidebarFooter className="border-t border-border">
        <SidebarMenu className="px-2 py-2">
          <SidebarMenuItem>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton onClick={() => navigate("/support")} className="w-fit rounded-xl">
                    <Headset className="w-5 h-5 shrink-0 text-muted-foreground" />
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
              <LogOut className="w-5 h-5 shrink-0 text-muted-foreground" />
              <span className="group-data-[collapsible=icon]:hidden text-muted-foreground text-sm">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Developed by */}
        <div className="group-data-[collapsible=icon]:hidden border-t border-border pt-3 pb-2 px-3 flex items-center justify-center gap-1.5">
          <span className="text-[8px] text-muted-foreground/40 tracking-[0.15em] uppercase whitespace-nowrap">Desenvolvido por</span>
          <img src={orizonLogo} alt="Orizon Tech" className="h-4 object-contain opacity-50 dark:invert" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
