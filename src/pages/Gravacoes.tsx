import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const placeholderData = [
  { data: "—", duracao: "—", tipo: "monitoramento", status: "pendente" },
  { data: "—", duracao: "—", tipo: "panico", status: "processado" },
];

export default function GravacoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Gravações</h1>
      <div className="ampara-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholderData.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.data}</TableCell>
                <TableCell>{row.duracao}</TableCell>
                <TableCell>
                  <Badge variant={row.tipo === "panico" ? "destructive" : "secondary"}>
                    {row.tipo}
                  </Badge>
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell className="text-right">
                  <button className="text-primary text-sm hover:underline">Ver</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground text-center">Dados reais serão exibidos em breve.</p>
    </div>
  );
}
