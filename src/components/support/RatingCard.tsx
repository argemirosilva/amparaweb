import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { callSupportApi } from "@/services/supportApiService";

interface RatingCardProps {
  sessionId: string;
  sessionToken: string;
  existingRating: { rating: number; comment?: string } | null;
  onRated: () => void;
}

export default function RatingCard({ sessionId, sessionToken, existingRating, onRated }: RatingCardProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  if (existingRating) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">Obrigada pela avaliação!</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-5 h-5 ${i <= existingRating.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          {existingRating.comment && (
            <p className="text-xs text-muted-foreground italic">"{existingRating.comment}"</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      const res = await callSupportApi("rateSession", sessionToken, {
        session_id: sessionId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Avaliação enviada!");
        onRated();
      } else {
        toast.error(res.data?.error || "Erro ao avaliar.");
      }
    } catch {
      toast.error("Erro ao enviar avaliação.");
    }
    setSending(false);
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground text-center">Como foi o atendimento?</p>
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  i <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Deixe um comentário (opcional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          className="min-h-[60px] text-sm"
        />
        <Button
          className="w-full"
          disabled={rating === 0 || sending}
          onClick={handleSubmit}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Enviar avaliação
        </Button>
      </CardContent>
    </Card>
  );
}
