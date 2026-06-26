import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/services/api";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewsList from "@/components/reviews/ReviewsList";
import SentimentResultCard from "@/components/reviews/SentimentResultCard";
import SentimentSummary from "@/components/reviews/SentimentSummary";

const ReviewSentimentTestPage = () => {
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [latestReview, setLatestReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [newProperty, setNewProperty] = useState({
    title: "Pearl Continental Test Hotel",
    city: "Islamabad",
    price: 12000,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProperties = async () => {
    const response = await api.get("/properties");
    setProperties(response.data.data || []);

    if (!selectedPropertyId && response.data.data?.length) {
      setSelectedPropertyId(response.data.data[0]._id);
    }
  };

  const fetchReviewData = async (propertyId) => {
    if (!propertyId) return;

    const [reviewsResponse, summaryResponse] = await Promise.all([
      api.get(`/reviews/property/${propertyId}`),
      api.get(`/sentiment/property/${propertyId}`),
    ]);

    setReviews(reviewsResponse.data.data || []);
    setSummary(summaryResponse.data.data || null);
  };

  useEffect(() => {
    fetchProperties().catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  useEffect(() => {
    fetchReviewData(selectedPropertyId).catch((err) => setError(err.response?.data?.message || err.message));
  }, [selectedPropertyId]);

  const handleCreateProperty = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/properties", newProperty);
      await fetchProperties();
      setSelectedPropertyId(response.data.data._id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create property.");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewCreated = async (review) => {
    setLatestReview(review);
    await fetchReviewData(selectedPropertyId);
  };

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Sentiment Test</h1>
          <p className="text-muted-foreground">
            Add a review from React, send it to Node.js, analyze it with Python model, and save result in MongoDB.
          </p>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Test Property</CardTitle>
              <CardDescription>Create one property first, then submit reviews against it.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProperty} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newProperty.title}
                    onChange={(e) => setNewProperty((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={newProperty.city}
                    onChange={(e) => setNewProperty((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={newProperty.price}
                    onChange={(e) => setNewProperty((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Property"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Property</CardTitle>
              <CardDescription>Review sentiment will be tested on selected property.</CardDescription>
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
                      {property.title} - {property.city}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => fetchReviewData(selectedPropertyId)}>
                Refresh Results
              </Button>
            </CardContent>
          </Card>
        </div>

        {selectedPropertyId ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ReviewForm propertyId={selectedPropertyId} onReviewCreated={handleReviewCreated} />
            <SentimentResultCard review={latestReview} />
          </div>
        ) : null}

        <SentimentSummary summary={summary} />
        <ReviewsList reviews={reviews} />
      </div>
    </main>
  );
};

export default ReviewSentimentTestPage;
