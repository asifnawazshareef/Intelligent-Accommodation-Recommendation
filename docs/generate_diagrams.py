# -*- coding: utf-8 -*-
"""
Generates every figure referenced in the IARS dissertation into
docs/dissertation_assets/*.png using diagram_gen.py.
Run: python generate_diagrams.py
"""
from diagram_gen import flow_diagram, seq_diagram, erd_diagram, class_diagram, bar_chart, usecase_diagram

created = []

# ---------------------------------------------------------------------
# 2.1 Use Case Diagram (standard UML notation: system boundary + actors + use-case ovals)
# ---------------------------------------------------------------------
uc_actors = [
    ("Guest", "Guest", "left"),
    ("Owner", "Property\nOwner", "left"),
    ("Admin", "Admin", "right"),
]
uc_usecases = [
    ("UC01", "Register\n(Guest/Owner)"), ("UC02", "Login"), ("UC03", "Search Properties"), ("UC04", "Filter Search\nResults"),
    ("UC05", "View Property\nDetails"), ("UC06", "Track Property\nView"), ("UC07", "Book Property\nOnline"), ("UC08", "Pay via Stripe\n(Test Mode)"),
    ("UC09", "Confirm Demo\nPayment"), ("UC10", "Cancel Booking"), ("UC11", "Submit Offline\nBooking Request"), ("UC12", "View Offline\nRequest Status"),
    ("UC13", "Respond to Offline\nRequest"), ("UC14", "Write Review"), ("UC15", "View Reviews &\nSentiment Summary"), ("UC16", "View\nRecommendations"),
    ("UC17", "Create/Edit\nProperty Listing"), ("UC18", "Upload Property\nImages"), ("UC19", "View Bookings"), ("UC20", "Approve/Reject\nListing"),
    ("UC21", "Audit Property\nImages"), ("UC22", "Manage Users"), ("UC23", "Switch Language\nor Theme"),
]
uc_associations = [
    ("Guest", "UC01"), ("Guest", "UC02"), ("Guest", "UC03"), ("Guest", "UC04"), ("Guest", "UC05"), ("Guest", "UC06"),
    ("Guest", "UC07"), ("Guest", "UC08"), ("Guest", "UC09"), ("Guest", "UC10"), ("Guest", "UC11"), ("Guest", "UC12"),
    ("Guest", "UC14"), ("Guest", "UC15"), ("Guest", "UC16"), ("Guest", "UC23"),
    ("Owner", "UC01"), ("Owner", "UC02"), ("Owner", "UC13"), ("Owner", "UC17"), ("Owner", "UC18"), ("Owner", "UC19"), ("Owner", "UC23"),
    ("Admin", "UC02"), ("Admin", "UC20"), ("Admin", "UC21"), ("Admin", "UC22"), ("Admin", "UC23"),
]
created.append(usecase_diagram(uc_actors, uc_usecases, uc_associations, "usecase_diagram",
               title="Use Case Diagram of the IARS Platform", cols=4))

# ---------------------------------------------------------------------
# 2.2-2.4 Activity diagrams
# ---------------------------------------------------------------------
created.append(flow_diagram([
    ["Start"], ["Search Properties\n(GET /api/search)"], ["View Property\nDetails"],
    ["Book Property\n(POST /api/bookings)"], [("Decision1", "Dates\nAvailable?")],
    ["Stripe Test\nCheckout"], ["Write Review\nafter Stay"], ["View Sentiment &\nRecommendations"], ["End"]
], [
    ("Start", "Search Properties\n(GET /api/search)", None),
    ("Search Properties\n(GET /api/search)", "View Property\nDetails", None),
    ("View Property\nDetails", "Book Property\n(POST /api/bookings)", None),
    ("Book Property\n(POST /api/bookings)", "Decision1", None),
    ("Decision1", "Stripe Test\nCheckout", "yes"),
    ("Stripe Test\nCheckout", "Write Review\nafter Stay", None),
    ("Write Review\nafter Stay", "View Sentiment &\nRecommendations", None),
    ("View Sentiment &\nRecommendations", "End", None),
], "activity_guest", node_styles={"Decision1": "decision"}, title="Guest Activity Diagram", v_gap=1.2))

created.append(flow_diagram([
    ["Start"], ["Login as Owner"], ["Create / Edit Property\nListing"], ["Upload up to 5\nImages"],
    [("D1", "Duplicate /\nLow-Quality Image?")], ["Await Admin\nImage Audit"],
    [("D2", ">=1 Verified\nImage?")], ["Listing Approved"], ["Respond to Offline\nRequests"], ["End"]
], [
    ("Start", "Login as Owner", None), ("Login as Owner", "Create / Edit Property\nListing", None),
    ("Create / Edit Property\nListing", "Upload up to 5\nImages", None),
    ("Upload up to 5\nImages", "D1", None),
    ("D1", "Await Admin\nImage Audit", "flagged suspicious"),
    ("Await Admin\nImage Audit", "D2", None),
    ("D2", "Listing Approved", "yes"),
    ("Listing Approved", "Respond to Offline\nRequests", None),
    ("Respond to Offline\nRequests", "End", None),
], "activity_owner", node_styles={"D1": "decision", "D2": "decision"}, title="Property Owner Activity Diagram", v_gap=1.2))

created.append(flow_diagram([
    ["Start"], ["Login as Admin"], ["Review Pending\nListings"], ["Open Image Audit\nQueue"],
    [("D1", "Image Meets\nQuality?")], ["Set Verified /\nSuspicious / Rejected"],
    [("D2", "Listing has >=1\nVerified Image?")], ["Approve Listing"], ["Manage Users\n(Verify / Role)"], ["End"]
], [
    ("Start", "Login as Admin", None), ("Login as Admin", "Review Pending\nListings", None),
    ("Review Pending\nListings", "Open Image Audit\nQueue", None),
    ("Open Image Audit\nQueue", "D1", None),
    ("D1", "Set Verified /\nSuspicious / Rejected", None),
    ("Set Verified /\nSuspicious / Rejected", "D2", None),
    ("D2", "Approve Listing", "yes"),
    ("Approve Listing", "Manage Users\n(Verify / Role)", None),
    ("Manage Users\n(Verify / Role)", "End", None),
], "activity_admin", node_styles={"D1": "decision", "D2": "decision"}, title="Admin Activity Diagram", v_gap=1.2))

# ---------------------------------------------------------------------
# 2.5-2.18 Sequence diagrams
# ---------------------------------------------------------------------
def seq(name, participants, msgs, title):
    created.append(seq_diagram(participants, msgs, name, title=title))

seq("seq_register", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Submit registration form"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/auth/register"},
    {"from": "Express API", "to": "MongoDB", "label": "hash password, save User"},
    {"from": "MongoDB", "to": "Express API", "label": "User document"},
    {"from": "Express API", "to": "Client (React)", "label": "JWT + user profile"},
    {"from": "Client (React)", "to": "Guest", "label": "Redirect to dashboard"},
], "Sequence Diagram – Register User")

seq("seq_login", ["Guest/Owner/Admin", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest/Owner/Admin", "to": "Client (React)", "label": "Submit email + password"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/auth/login"},
    {"from": "Express API", "to": "MongoDB", "label": "findOne({email}).select('+password')"},
    {"from": "MongoDB", "to": "Express API", "label": "User document"},
    {"from": "Express API", "to": "Express API", "label": "bcrypt.compare()", "type": "note"},
    {"from": "Express API", "to": "Client (React)", "label": "JWT token + role"},
    {"from": "Client (React)", "to": "Guest/Owner/Admin", "label": "Redirect by role"},
], "Sequence Diagram – Login")

seq("seq_search", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Enter city / price / date filters"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/search?city=&minPrice=&maxPrice="},
    {"from": "Express API", "to": "MongoDB", "label": "save SearchHistory (optionalProtect)"},
    {"from": "Express API", "to": "MongoDB", "label": "find approved Properties matching filters"},
    {"from": "MongoDB", "to": "Express API", "label": "matching Property list"},
    {"from": "Express API", "to": "Client (React)", "label": "search results"},
    {"from": "Client (React)", "to": "Guest", "label": "render PropertySearchResults"},
], "Sequence Diagram – Search and Filter Properties")

seq("seq_viewdetails", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Open property detail page"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/properties/:id (optionalProtect)"},
    {"from": "Express API", "to": "MongoDB", "label": "fetch Property + sentimentSnapshot"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/properties/:id/view"},
    {"from": "Express API", "to": "MongoDB", "label": "upsert PropertyView"},
    {"from": "Express API", "to": "Client (React)", "label": "property + gallery + reviews"},
    {"from": "Client (React)", "to": "Guest", "label": "render gallery, snapshot, booking panel"},
], "Sequence Diagram – View Property Details")

seq("seq_booking", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Select dates and guests"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/bookings"},
    {"from": "Express API", "to": "MongoDB", "label": "check availabilityCalendar + overlap"},
    {"from": "MongoDB", "to": "Express API", "label": "no conflicting Booking found"},
    {"from": "Express API", "to": "MongoDB", "label": "create Booking (pending, totalAmount)"},
    {"from": "Express API", "to": "Client (React)", "label": "booking id + totalAmount"},
    {"from": "Client (React)", "to": "Guest", "label": "proceed to payment step"},
], "Sequence Diagram – Book Property and Create Booking")

seq("seq_payment", ["Guest", "Client (React)", "Express API", "Stripe (Test Mode)"], [
    {"from": "Guest", "to": "Client (React)", "label": "Click Pay Now"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/payments/stripe/create-checkout-session"},
    {"from": "Express API", "to": "Stripe (Test Mode)", "label": "create Checkout Session (PKR to USD cents)"},
    {"from": "Stripe (Test Mode)", "to": "Express API", "label": "session URL"},
    {"from": "Express API", "to": "Client (React)", "label": "redirect URL"},
    {"from": "Client (React)", "to": "Guest", "label": "redirect to Stripe Checkout"},
    {"from": "Stripe (Test Mode)", "to": "Express API", "label": "webhook / verify-session (paid)"},
    {"from": "Express API", "to": "Express API", "label": "markBookingStripePaid()", "type": "note"},
], "Sequence Diagram – Stripe Checkout Payment")

seq("seq_cancel", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Click Cancel Booking"},
    {"from": "Client (React)", "to": "Express API", "label": "PUT /api/bookings/:id/cancel"},
    {"from": "Express API", "to": "MongoDB", "label": "verify guest owns booking"},
    {"from": "Express API", "to": "MongoDB", "label": "set status = cancelled"},
    {"from": "Express API", "to": "Client (React)", "label": "updated booking"},
    {"from": "Client (React)", "to": "Guest", "label": "show cancelled status"},
], "Sequence Diagram – Cancel Booking")

seq("seq_offline_submit", ["Guest / Visitor", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest / Visitor", "to": "Client (React)", "label": "Fill offline request form"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/offline-requests (optionalProtect)"},
    {"from": "Express API", "to": "MongoDB", "label": "create OfflineRequest (status=pending)"},
    {"from": "MongoDB", "to": "Express API", "label": "saved request"},
    {"from": "Express API", "to": "Client (React)", "label": "confirmation"},
    {"from": "Client (React)", "to": "Guest / Visitor", "label": "show pending status"},
], "Sequence Diagram – Submit Offline Booking Request")

seq("seq_offline_respond", ["Owner", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Owner", "to": "Client (React)", "label": "Open Offline Requests list"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/offline-requests/owner"},
    {"from": "Owner", "to": "Client (React)", "label": "Write response message"},
    {"from": "Client (React)", "to": "Express API", "label": "PUT /api/offline-requests/:id/respond"},
    {"from": "Express API", "to": "MongoDB", "label": "verify property ownership"},
    {"from": "Express API", "to": "MongoDB", "label": "set responseMessage, status=responded"},
    {"from": "Express API", "to": "Client (React)", "label": "updated request"},
], "Sequence Diagram – Owner Responds to Offline Request")

seq("seq_review", ["Guest", "Client (React)", "Express API", "Sentiment Service (FastAPI)", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Submit rating + review text"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/reviews"},
    {"from": "Express API", "to": "MongoDB", "label": "verify confirmed booking, no prior review"},
    {"from": "Express API", "to": "Sentiment Service (FastAPI)", "label": "POST /predict {review}"},
    {"from": "Sentiment Service (FastAPI)", "to": "Express API", "label": "sentiment, confidence, aspects, summary"},
    {"from": "Express API", "to": "MongoDB", "label": "save Review + syncPropertySentiment()"},
    {"from": "Express API", "to": "Client (React)", "label": "saved review + sentiment"},
    {"from": "Client (React)", "to": "Guest", "label": "show sentiment summary"},
], "Sequence Diagram – Write Review and Sentiment Analysis")

seq("seq_recommend", ["Guest", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Guest", "to": "Client (React)", "label": "Load home / search page"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/recommendations (optionalProtect)"},
    {"from": "Express API", "to": "MongoDB", "label": "buildUserProfile() from history"},
    {"from": "Express API", "to": "Express API", "label": "buildRecommendationMode()", "type": "note"},
    {"from": "Express API", "to": "MongoDB", "label": "fetch approved Properties + sentiment"},
    {"from": "Express API", "to": "Express API", "label": "score & section (Bayesian / hybrid)", "type": "note"},
    {"from": "Express API", "to": "Client (React)", "label": "sectioned recommendations"},
    {"from": "Client (React)", "to": "Guest", "label": "render RecommendedProperties"},
], "Sequence Diagram – View Personalized Recommendations")

seq("seq_listing", ["Owner", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Owner", "to": "Client (React)", "label": "Fill PropertyForm + select images"},
    {"from": "Client (React)", "to": "Express API", "label": "POST /api/properties (multipart)"},
    {"from": "Express API", "to": "Express API", "label": "SHA-256 hash + duplicate check", "type": "note"},
    {"from": "Express API", "to": "Express API", "label": "imageAiScore.js heuristic score", "type": "note"},
    {"from": "Express API", "to": "MongoDB", "label": "save Property (status=pending, images[])"},
    {"from": "Express API", "to": "Client (React)", "label": "created listing"},
    {"from": "Client (React)", "to": "Owner", "label": "show pending-approval status"},
], "Sequence Diagram – Create or Edit Listing with Image Upload")

seq("seq_approve", ["Admin", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Admin", "to": "Client (React)", "label": "Open pending listings queue"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/admin/listings/pending"},
    {"from": "Admin", "to": "Client (React)", "label": "Click Approve"},
    {"from": "Client (React)", "to": "Express API", "label": "PUT /api/admin/listings/:id/approve"},
    {"from": "Express API", "to": "Express API", "label": "hasVerifiedImage() check", "type": "note"},
    {"from": "Express API", "to": "MongoDB", "label": "set Property.status = approved"},
    {"from": "Express API", "to": "Client (React)", "label": "updated listing"},
], "Sequence Diagram – Admin Approve or Reject Listing")

seq("seq_admin", ["Admin", "Client (React)", "Express API", "MongoDB"], [
    {"from": "Admin", "to": "Client (React)", "label": "Open Image Audit page"},
    {"from": "Client (React)", "to": "Express API", "label": "GET /api/admin/image-audit"},
    {"from": "Admin", "to": "Client (React)", "label": "Set image verificationStatus"},
    {"from": "Client (React)", "to": "Express API", "label": "PUT /api/admin/image-audit/:propertyId/:imageId"},
    {"from": "Express API", "to": "MongoDB", "label": "update image sub-document"},
    {"from": "Admin", "to": "Client (React)", "label": "Open Manage Users page"},
    {"from": "Client (React)", "to": "Express API", "label": "PUT /api/admin/users/:id/verify"},
    {"from": "Express API", "to": "MongoDB", "label": "update User.isVerified"},
], "Sequence Diagram – Admin Image Audit and User Management")

# ---------------------------------------------------------------------
# 3.1 Architecture overview
# ---------------------------------------------------------------------
created.append(flow_diagram([
    ["Client (React + Vite)\nTailwind, i18next, shadcn/ui"],
    ["Express.js API Server\n(Node.js, JWT auth, Mongoose)"],
    [("DB", "MongoDB\n(7 collections)"), ("PY", "Sentiment Microservice\n(FastAPI, TF-IDF + LogReg)"), ("STRIPE", "Stripe API\n(Test Mode)")],
], [
    ("Client (React + Vite)\nTailwind, i18next, shadcn/ui", "Express.js API Server\n(Node.js, JWT auth, Mongoose)", "axios (HTTPS/JSON, JWT bearer)"),
    ("Express.js API Server\n(Node.js, JWT auth, Mongoose)", "DB", "Mongoose ODM"),
    ("Express.js API Server\n(Node.js, JWT auth, Mongoose)", "PY", "POST /predict"),
    ("Express.js API Server\n(Node.js, JWT auth, Mongoose)", "STRIPE", "Checkout Session API"),
], "arch_overview", title="System Architecture Overview", v_gap=1.4, node_w=3.2, h_gap=1.6))

# ---------------------------------------------------------------------
# 3.2 ERD
# ---------------------------------------------------------------------
entities = {
    "User": ["PK _id", "name", "email (unique)", "phone", "password (hashed)", "role", "languagePref", "isVerified"],
    "Property": ["PK _id", "FK owner -> User", "title / description", "location{address,city,country}", "price", "images[] (embedded)", "availabilityCalendar[]", "status", "sentimentSnapshot"],
    "Booking": ["PK _id", "FK guest -> User", "FK property -> Property", "startDate / endDate", "guests", "totalAmount", "status", "paymentStatus", "paymentMethod"],
    "Review": ["PK _id", "FK guest -> User", "FK property -> Property", "FK booking -> Booking (unique)", "rating", "text", "sentiment", "aspects[]"],
    "OfflineRequest": ["PK _id", "FK property -> Property (nullable)", "FK guest -> User (nullable)", "guestName / phone", "startDate / endDate / roomType", "status", "responseMessage"],
    "PropertyView": ["PK _id", "FK user -> User", "FK property -> Property", "viewedAt"],
    "SearchHistory": ["PK _id", "FK user -> User", "city / title", "minPrice / maxPrice", "availabilityDate"],
}
rels = [
    ("User", "Property", "1 owns *"), ("User", "Booking", "1 makes *"), ("Property", "Booking", "1 receives *"),
    ("Booking", "Review", "1 -- 0..1"), ("User", "Review", "1 writes *"), ("Property", "Review", "1 has *"),
    ("User", "OfflineRequest", "0..1 submits *"), ("Property", "OfflineRequest", "0..1 relates to *"),
    ("User", "PropertyView", "1 generates *"), ("Property", "PropertyView", "1 viewed by *"),
    ("User", "SearchHistory", "1 generates *"),
]
created.append(erd_diagram(entities, rels, "erd", title="Entity Relationship Diagram (MongoDB / Mongoose)", cols=4))

# ---------------------------------------------------------------------
# 3.3 Class diagram
# ---------------------------------------------------------------------
classes = {
    "User": {"attrs": ["name", "email", "password", "role", "languagePref", "isVerified"], "methods": ["matchPassword()"]},
    "Property": {"attrs": ["title", "location", "price", "images[]", "status", "sentimentSnapshot"], "methods": ["isWithinAvailability()"]},
    "Booking": {"attrs": ["startDate", "endDate", "totalAmount", "status", "paymentStatus"], "methods": ["calculateBookingTotal()"]},
    "Review": {"attrs": ["rating", "text", "sentiment", "aspects[]"], "methods": []},
    "AuthController": {"attrs": [], "methods": ["registerUser()", "loginUser()", "getMe()"]},
    "BookingController": {"attrs": [], "methods": ["createBooking()", "cancelBooking()", "confirmDemoPayment()"]},
    "RecommendationEngine": {"attrs": ["MIN_QUALITY_SCORE"], "methods": ["buildRecommendationMode()", "buildColdStart()", "buildStructured()"]},
    "SentimentService": {"attrs": ["SENTIMENT_API_URL"], "methods": ["analyzeSentiment()"]},
}
crels = [
    ("User", "Property", "owns"), ("User", "Booking", "makes"), ("Property", "Booking", "booked as"),
    ("Booking", "Review", "reviewed via"), ("AuthController", "User", "manages"),
    ("BookingController", "Booking", "manages"), ("RecommendationEngine", "Property", "ranks"),
    ("Review", "SentimentService", "classified by"),
]
created.append(class_diagram(classes, crels, "class_diagram", title="Class Diagram (Core Models and Controllers)", cols=4))

# ---------------------------------------------------------------------
# 3.4-3.6 pipelines
# ---------------------------------------------------------------------
created.append(flow_diagram([
    ["Build User Profile\n(buildUserProfile.js)"],
    ["Fetch Approved\nProperty Candidates"],
    [("D1", "Has Interaction\nSignals?")],
    ["Hybrid Personalized Scoring\n(similarity + collaborative + Bayesian)", "Cold-Start Scoring\n(Bayesian quality only)"],
    ["Section & Cap\nResults (max 24)"],
    ["Return Sectioned\nRecommendations"],
], [
    ("Build User Profile\n(buildUserProfile.js)", "Fetch Approved\nProperty Candidates", None),
    ("Fetch Approved\nProperty Candidates", "D1", None),
    ("D1", "Hybrid Personalized Scoring\n(similarity + collaborative + Bayesian)", "yes"),
    ("D1", "Cold-Start Scoring\n(Bayesian quality only)", "no"),
    ("Hybrid Personalized Scoring\n(similarity + collaborative + Bayesian)", "Section & Cap\nResults (max 24)", None),
    ("Cold-Start Scoring\n(Bayesian quality only)", "Section & Cap\nResults (max 24)", None),
    ("Section & Cap\nResults (max 24)", "Return Sectioned\nRecommendations", None),
], "pipeline_recommend", node_styles={"D1": "decision"}, title="Recommendation Engine Pipeline", v_gap=1.3))

created.append(flow_diagram([
    ["Review Text\nSubmitted"], ["Split into\nClauses"], ["TF-IDF + Logistic\nRegression per Clause"],
    ["Rule-Based Negation\nOverride"], ["Aspect Keyword\nDetection (9 categories)"],
    ["Aggregate Overall\nSentiment"], ["Persist on Review +\nResync Property Snapshot"],
], [
    ("Review Text\nSubmitted", "Split into\nClauses", None),
    ("Split into\nClauses", "TF-IDF + Logistic\nRegression per Clause", None),
    ("TF-IDF + Logistic\nRegression per Clause", "Rule-Based Negation\nOverride", None),
    ("Rule-Based Negation\nOverride", "Aspect Keyword\nDetection (9 categories)", None),
    ("Aspect Keyword\nDetection (9 categories)", "Aggregate Overall\nSentiment", None),
    ("Aggregate Overall\nSentiment", "Persist on Review +\nResync Property Snapshot", None),
], "pipeline_sentiment", title="Sentiment Analysis Pipeline", v_gap=1.3))

created.append(flow_diagram([
    ["Owner Uploads\nImage(s)"], ["Compute SHA-256\nHash"], [("D1", "Duplicate\nHash?")],
    ["Discard (same batch) /\nMark Suspicious (aiScore 0.45)", "Compute Heuristic aiScore\n(imageAiScore.js)"],
    ["Status = Pending"], ["Admin Reviews in\nImage Audit Queue"],
    ["Set Verified / Suspicious /\nRejected"], [("D2", "Listing has >=1\nVerified Image?")],
    ["Listing Eligible\nfor Approval"],
], [
    ("Owner Uploads\nImage(s)", "Compute SHA-256\nHash", None),
    ("Compute SHA-256\nHash", "D1", None),
    ("D1", "Discard (same batch) /\nMark Suspicious (aiScore 0.45)", "yes"),
    ("D1", "Compute Heuristic aiScore\n(imageAiScore.js)", "no"),
    ("Compute Heuristic aiScore\n(imageAiScore.js)", "Status = Pending", None),
    ("Status = Pending", "Admin Reviews in\nImage Audit Queue", None),
    ("Discard (same batch) /\nMark Suspicious (aiScore 0.45)", "Admin Reviews in\nImage Audit Queue", None),
    ("Admin Reviews in\nImage Audit Queue", "Set Verified / Suspicious /\nRejected", None),
    ("Set Verified / Suspicious /\nRejected", "D2", None),
    ("D2", "Listing Eligible\nfor Approval", "yes"),
], "pipeline_image", node_styles={"D1": "decision", "D2": "decision"}, title="Image Verification Workflow", v_gap=1.3))

# ---------------------------------------------------------------------
# 3.7-3.9 state diagrams
# ---------------------------------------------------------------------
created.append(flow_diagram([
    [("P", "pending")], [("C", "confirmed")], [("X", "cancelled")],
], [
    ("P", "C", "Stripe paid / demo-confirm"),
    ("P", "X", "guest cancels"),
    ("C", "X", "guest cancels"),
], "state_booking", node_styles={"P": "actor", "C": "actor", "X": "actor"},
   title="Booking Status Lifecycle", v_gap=1.3, node_w=2.2))

created.append(flow_diagram([
    [("P", "pending")], [("R", "responded")], [("CL", "closed")],
], [
    ("P", "R", "owner responds"),
    ("R", "CL", "owner closes"),
    ("P", "CL", "owner closes directly"),
], "state_offline", node_styles={"P": "actor", "R": "actor", "CL": "actor"},
   title="Offline Request Status Lifecycle", v_gap=1.3, node_w=2.2))

created.append(flow_diagram([
    [("P", "pending")], [("V", "verified"), ("S", "suspicious"), ("RJ", "rejected")],
], [
    ("P", "V", "admin verifies"),
    ("P", "S", "duplicate hash / admin flags"),
    ("P", "RJ", "admin rejects"),
    ("S", "RJ", "admin rejects"),
    ("S", "V", "admin overrides"),
], "state_image", node_styles={"P": "actor", "V": "actor", "S": "actor", "RJ": "actor"},
   title="Image Verification Status Lifecycle", v_gap=1.3, node_w=2.2))

# ---------------------------------------------------------------------
# 3.10 Deployment diagram
# ---------------------------------------------------------------------
created.append(flow_diagram([
    ["Browser\n(Client Device)"],
    ["Vite Dev Server /\nStatic Build :5173"],
    ["Node.js + Express\nServer :5000"],
    [("DB", "MongoDB\nInstance"), ("PY", "Python/FastAPI\nSentiment Service :8000"), ("STRIPE", "Stripe API\n(External, Test Mode)")],
], [
    ("Browser\n(Client Device)", "Vite Dev Server /\nStatic Build :5173", "HTTPS"),
    ("Vite Dev Server /\nStatic Build :5173", "Node.js + Express\nServer :5000", "REST / JSON (axios)"),
    ("Node.js + Express\nServer :5000", "DB", "Mongoose (TCP 27017)"),
    ("Node.js + Express\nServer :5000", "PY", "HTTP (localhost:8000)"),
    ("Node.js + Express\nServer :5000", "STRIPE", "HTTPS API + Webhook"),
], "deployment", title="Deployment Diagram", v_gap=1.4, node_w=3.0, h_gap=1.6))

print("Generated", len(created), "diagrams:")
for c in created:
    print(" -", c)
