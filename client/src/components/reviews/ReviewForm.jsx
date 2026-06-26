import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/services/api";

const ReviewForm = ({ propertyId, onReviewCreated }) => {
  const [form, setForm] = useState({
    guestName: "Test Guest",
    rating: 5,
    comment: "The room was clean and the staff was helpful, but the Wi-Fi was poor.",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/reviews", {
        propertyId,
        guestName: form.guestName,
        rating: Number(form.rating),
        comment: form.comment,
      });

      onReviewCreated?.(response.data.data);
      setForm((prev) => ({ ...prev, comment: "" }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Review</CardTitle>
        <CardDescription>
          Submit a review and see the trained sentiment model result.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guestName">Guest Name</Label>
            <Input id="guestName" name="guestName" value={form.guestName} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rating">Rating</Label>
            <select
              id="rating"
              name="rating"
              value={form.rating}
              onChange={handleChange}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Bad</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Review Comment</Label>
            <Textarea
              id="comment"
              name="comment"
              value={form.comment}
              onChange={handleChange}
              rows={5}
              required
              placeholder="Write guest review here..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Analyzing..." : "Submit Review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
