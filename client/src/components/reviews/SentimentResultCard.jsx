import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SentimentBadge from "./SentimentBadge";

const SentimentResultCard = ({ review }) => {
  if (!review) return null;

  return (
    <Card className="border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          Latest Sentiment Result
          <SentimentBadge sentiment={review.sentiment} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">Review</p>
          <p className="text-sm text-muted-foreground">{review.comment}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-semibold">{Math.round((review.sentimentScore || 0) * 100)}%</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Rating</p>
            <p className="text-lg font-semibold">{review.rating}/5</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Aspects</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(review.aspects || []).length ? (
              review.aspects.map((aspect) => (
                <span key={aspect} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {aspect}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No aspects detected.</p>
            )}
          </div>
        </div>
        {review.summary ? (
          <div>
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm text-muted-foreground">{review.summary}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default SentimentResultCard;
