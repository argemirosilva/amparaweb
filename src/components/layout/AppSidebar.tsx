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
  MessageCircle,
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
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
          <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover invert mix-blend-screen" />
        </div>
        <span className="font-display font-bold text-white text-lg group-data-[collapsible=icon]:hidden">
          AMPARA
        </span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton onClick={() => navigate("/support")} className="w-fit">
                    <MessageCircle className="w-5 h-5 shrink-0 text-sidebar-foreground/70" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Suporte Técnico</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="w-5 h-5 shrink-0 text-destructive" />
              <span className="group-data-[collapsible=icon]:hidden text-destructive">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Desenvolvido por */}
        <div className="group-data-[collapsible=icon]:hidden border-t border-sidebar-border pt-3 pb-2 px-3 flex items-center justify-center gap-2">
          <span className="text-[10px] text-sidebar-foreground/40 tracking-wide whitespace-nowrap">Desenvolvido por</span>
          <img src={orizonLogo} alt="Orizon Tech" className="h-4 object-contain opacity-50" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
