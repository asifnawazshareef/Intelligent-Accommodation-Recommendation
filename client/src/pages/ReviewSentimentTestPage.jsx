import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RefreshButton from "@/components/ui/RefreshButton";
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
  const { isAuthenticated, user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [latestReview, setLatestReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      await fetchProperties();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) return;

    fetchReviewData(selectedPropertyId).catch((err) =>
      setError(err.response?.data?.message || err.message),
    );
  }, [selectedPropertyId]);

  const handleRefresh = async () => {
    if (!selectedPropertyId) return;

    setRefreshing(true);
    setError("");

    try {
      await fetchReviewData(selectedPropertyId);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewCreated = async (review) => {
    setLatestReview(review);
    await fetchReviewData(selectedPropertyId);
  };

  const canSubmitReview = isAuthenticated && user?.role === "guest";

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <PageHeader
          title="Review Sentiment Test"
          description="View sentiment analysis results for property reviews. Submit reviews as a logged-in guest with a confirmed booking."
          actions={
            selectedPropertyId ? (
              <RefreshButton
                onClick={handleRefresh}
                loading={refreshing}
                label="Refresh Results"
                className="w-full sm:w-auto"
              />
            ) : null
          }
        />

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

        {!loading && properties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No approved properties"
            description="Add and approve listings before testing review sentiment."
          />
        ) : (
          <Card className="glass-card">
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
                  disabled={loading}
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.title} — {property.location?.city}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

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
    </DashboardLayout>
  );
};

export default ReviewSentimentTestPage;
