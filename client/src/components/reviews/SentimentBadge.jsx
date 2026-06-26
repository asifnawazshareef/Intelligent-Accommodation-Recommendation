import { Badge } from "@/components/ui/badge";

const sentimentClasses = {
  positive: "bg-green-100 text-green-800 hover:bg-green-100",
  negative: "bg-red-100 text-red-800 hover:bg-red-100",
  neutral: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  mixed: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
};

const SentimentBadge = ({ sentiment = "neutral" }) => {
  return (
    <Badge className={sentimentClasses[sentiment] || sentimentClasses.neutral}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </Badge>
  );
};

export default SentimentBadge;
