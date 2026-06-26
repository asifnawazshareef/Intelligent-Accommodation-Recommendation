import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SentimentBadge from "./SentimentBadge";

const ReviewsList = ({ reviews = [] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review._id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{review.guestName}</p>
                    <p className="text-sm text-muted-foreground">Rating: {review.rating}/5</p>
                  </div>
                  <SentimentBadge sentiment={review.sentiment} />
                </div>
                <p className="mt-3 text-sm">{review.comment}</p>
                {review.summary ? (
                  <p className="mt-2 text-sm text-muted-foreground">{review.summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews found.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsList;
