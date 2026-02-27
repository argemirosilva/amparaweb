import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, ChevronDown } from "lucide-react";

interface GravacoesFilterBarProps {
  searchText: string;
  onSearchTextChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  deviceFilter: string;
  onDeviceFilterChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export default function GravacoesFilterBar({
  searchText,
  onSearchTextChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  deviceFilter,
  onDeviceFilterChange,
  onClear,
  hasActiveFilters,
}: GravacoesFilterBarProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  const showFilters = !isMobile || expanded;

  return (
    <div className="space-y-2">
      {/* Search + toggle row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            placeholder="Buscar na transcrição..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        {isMobile && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground shrink-0"
            onClick={onClear}
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">De</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-7 text-xs w-[130px]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">Até</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-7 text-xs w-[130px]"
            />
          </div>
          <Select value={deviceFilter} onValueChange={onDeviceFilterChange}>
            <SelectTrigger className="h-7 text-xs w-[110px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="mobile">Celular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
