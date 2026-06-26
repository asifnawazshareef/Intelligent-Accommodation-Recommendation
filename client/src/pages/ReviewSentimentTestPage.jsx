import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getApprovedProperties } from "@/services/propertyService";
import {
  getPropertyReviews,
  getPropertySentimentSummary,
} from "@/services/reviewService";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewsList from "@/components/reviews/ReviewsList";
import SentimentResultCard from "@/components/reviews/SentimentResultCard";
import SentimentSummary from "@/components/reviews/SentimentSummary";

const ReviewSentimentTestPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [latestReview, setLatestReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const fetchProperties = async () => {
    const response = await getApprovedProperties();
    setProperties(response.data.data || []);

    if (!selectedPropertyId && response.data.data?.length) {
      setSelectedPropertyId(response.data.data[0]._id);
    }
  };

  const fetchReviewData = async (propertyId) => {
    if (!propertyId) return;

    const [reviewsResponse, summaryResponse] = await Promise.all([
      getPropertyReviews(propertyId),
      getPropertySentimentSummary(propertyId),
    ]);

    setReviews(reviewsResponse.data.data || []);
    setSummary(summaryResponse.data.data || null);
  };

  useEffect(() => {
    fetchProperties().catch((err) =>
      setError(err.response?.data?.message || err.message),
    );
  }, []);

  useEffect(() => {
    fetchReviewData(selectedPropertyId).catch((err) =>
      setError(err.response?.data?.message || err.message),
    );
  }, [selectedPropertyId]);

  const handleReviewCreated = async (review) => {
    setLatestReview(review);
    await fetchReviewData(selectedPropertyId);
  };

  const canSubmitReview = isAuthenticated && user?.role === "guest";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Review Sentiment Test
          </h1>
          <p className="text-muted-foreground">
            View sentiment analysis results for property reviews. Submit reviews
            as a logged-in guest with a confirmed booking.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!canSubmitReview ? (
          <Alert>
            <AlertDescription>
              Log in as a guest with a confirmed booking to submit reviews.{" "}
              <Link to="/login" className="font-medium underline">
                Sign in
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Select Property</CardTitle>
            <CardDescription>
              Choose an approved property to inspect review sentiment data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property._id} value={property._id}>
                    {property.title} — {property.location?.city}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchReviewData(selectedPropertyId)}
            >
              Refresh Results
            </Button>
          </CardContent>
        </Card>

        {selectedPropertyId ? (
          <>
            {canSubmitReview ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <ReviewForm
                  propertyId={selectedPropertyId}
                  onReviewCreated={handleReviewCreated}
                />
                <SentimentResultCard review={latestReview} />
              </div>
            ) : null}

            {summary?.totalReviews > 0 && (
              <SentimentSummary summary={summary} />
            )}
            <ReviewsList reviews={reviews} />
          </>
        ) : null}
      </div>
    </main>
  );
};

export default ReviewSentimentTestPage;
