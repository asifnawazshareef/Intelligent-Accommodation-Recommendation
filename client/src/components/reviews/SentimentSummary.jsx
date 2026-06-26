import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StatCard = ({ label, value }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold">{value}</p>
  </div>
);

const SentimentSummary = ({ summary }) => {
  const data = summary || {};
  const aspectCounts = data.aspectCounts || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Sentiment Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Reviews" value={data.totalReviews || 0} />
          <StatCard label="Average Rating" value={data.averageRating || 0} />
          <StatCard label="Positive" value={data.positiveCount || 0} />
          <StatCard label="Negative" value={data.negativeCount || 0} />
          <StatCard label="Neutral" value={data.neutralCount || 0} />
          <StatCard label="Mixed" value={data.mixedCount || 0} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Top Mentioned Aspects</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(aspectCounts).length ? (
              Object.entries(aspectCounts).map(([aspect, count]) => (
                <span key={aspect} className="rounded-full border px-3 py-1 text-xs">
                  {aspect}: {count}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No aspects available yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SentimentSummary;
