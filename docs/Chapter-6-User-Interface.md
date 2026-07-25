## 6.1 Introduction to the User Interface

The preceding chapters described how the Intelligent Accommodation Review System (IARS) is designed and built across its client, server, and sentiment-analysis layers. This chapter turns from implementation to experience, presenting a systematic walkthrough of every screen that a user of the deployed application actually encounters. Because IARS distinguishes between three categories of user — the guest who searches for and books accommodation, the property owner who lists and manages properties, and the administrator who moderates the platform — the chapter is organized around these three roles, with one section devoted to each. A fourth section addresses interface elements that are shared across all roles, namely language switching and light/dark theming, and the chapter closes with a brief summary.

Every screen described below is drawn directly from the pages and components implemented in the `client/src` source tree; no page, form field, or control is introduced that does not exist in the codebase. Because no live-running capture of the deployed instance is available at the time of writing, each screen is represented by a labelled figure placeholder rather than an actual screenshot, accompanied by a prose description of the screen's structure, content, and behaviour.

A distinguishing characteristic of the IARS interface, applicable to every screen discussed in this chapter, is that it is fully localized. The application supports English, Urdu, and Arabic, with English as the default language, and it switches automatically between left-to-right and right-to-left layout depending on the language selected. In addition, every screen supports a light and a dark visual theme, selectable independently of the language.

## 6.2 Guest Interface

The guest is the primary consumer-facing actor in IARS: an unauthenticated visitor or registered account holder who searches for properties, reviews their details, books a stay, pays for it, and subsequently leaves a review. This section walks through the nine guest-facing screens in the order a guest would typically encounter them, from initial registration through to booking confirmation and follow-up actions.

### 6.2.1 Guest Registration

New users create an account through the registration page, implemented in `RegisterPage.jsx`. The form collects the fields required to establish an account and to personalise the experience from the outset: full name, email address, phone number, password, an account role selector distinguishing between "guest" and "owner", and a language preference field. Capturing the role at registration time allows the system to route the new account into the correct dashboard and permission set immediately after sign-up, while the language preference field allows a user's chosen interface language to be recorded as part of their profile rather than re-selected on every visit. As with all authentication-related forms in the system, the registration page is rendered in the interface language currently active in the browser, and its layout mirrors correctly when that language is Urdu or Arabic.

FIGURE_CAPTION: Figure 6.1: Guest Registration Page (RegisterPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.2 Guest Login

Returning users authenticate through the login page, implemented in `LoginPage.jsx`, which presents a straightforward email and password form. A notable behaviour of this screen is its handling of session expiry: if a user is redirected to the login page because a previous request was rejected with an unauthorized (401) response — for example, after a JSON Web Token has expired during an active session — the page displays a session-expired alert banner above the form, informing the user that they must sign in again to continue. This distinguishes a routine login visit from an involuntary one caused by session timeout, giving the user context for why they have landed back on this screen. Once credentials are submitted successfully, the user is routed to the dashboard appropriate to their role.

FIGURE_CAPTION: Figure 6.2: Login Page with Session-Expired Alert (LoginPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.3 Home Page and Search Page

Property discovery begins at the home page, `HomePage.jsx`, whose hero section presents a search form to any visitor, authenticated or not. As soon as search criteria are entered, the page displays a live preview of matching results directly beneath the hero, capped at eight properties, with a "view all" link that carries the visitor through to the dedicated search page for the complete result set. Below the results preview, the home page also surfaces a recommendations section, presenting properties suggested to the current visitor independently of the search they have just performed.

The dedicated search page, `SearchPage.jsx`, expands on this with the full `PropertySearchForm`, exposing the complete set of search and filter controls, followed by the `PropertySearchResults` component rendered as a grid of property cards, and, beneath the results, a `RecommendedProperties` section mirroring the recommendation logic used on the home page. Together, the two pages give guests both a fast, minimal entry point for a quick search and a fuller page for browsing and refining results at length.

FIGURE_CAPTION: Figure 6.3: Home Page Search and Search Results Page (HomePage.jsx / SearchPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.4 Property Detail Page

`PropertyDetailPage.jsx` is the most content-dense guest-facing screen in the system. At the top of the page sits an image gallery for the property, with each image showing its verification badge so that guests can see, at a glance, which photographs have passed image verification. On smaller screens, a mobile sentiment snapshot is shown near the top of the page, giving a condensed view of review sentiment before the guest scrolls further. Navigation through the page's content is assisted by a sticky section-navigation bar containing pills for "About", "Location", "Availability", and "Reviews", allowing the guest to jump directly to a section of interest.

The page body itself presents the property description, its address, and its availability date ranges, followed by the `SentimentSummary` component, a `ReviewForm` (visible only to authenticated guests), and the `ReviewsList` showing existing reviews. On desktop, a sticky `PropertyBookingPanel` remains visible alongside the content, showing the price, aggregate rating, an insight strip, and buttons to begin an online booking or submit an offline booking request; on mobile, this is replaced by a fixed bottom call-to-action bar offering the same two actions.

FIGURE_CAPTION: Figure 6.4: Property Detail Page (PropertyDetailPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.5 Booking Creation Page

Once a guest chooses to book online from the property detail page, they arrive at `BookingNewPage.jsx`, the first step of the online booking flow. A `BookingStepIndicator` at the top of the page marks this as step one of the process, orienting the guest within the overall booking sequence. The form itself collects the intended start date, end date, and number of guests for the stay. As dates are entered, the page performs overlap validation against the property's existing bookings and availability windows, preventing the guest from proceeding with a date range that conflicts with an already-booked or unavailable period. Only once a valid, non-overlapping date range and guest count have been supplied can the guest proceed to the payment step.

FIGURE_CAPTION: Figure 6.5: Booking Creation Page (BookingNewPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.6 Booking Payment Page

The second step of the booking flow is handled by `BookingPaymentPage.jsx`, again marked by the `BookingStepIndicator`, this time showing step two. The page presents a summary of the booking just created — the property, the selected dates, and the resulting total — so the guest can confirm the details before paying. Payment itself is initiated through a Stripe checkout button, which hands the guest off to Stripe's hosted checkout flow to complete payment for the booking. Successful completion of this step updates the underlying booking's payment status and carries the guest forward to the confirmation page.

FIGURE_CAPTION: Figure 6.6: Booking Payment Page (BookingPaymentPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.7 Booking Payment Success Page

After payment completes, the guest is directed to `BookingPaymentSuccessPage.jsx`, which displays a confirmation card acknowledging that the booking and payment have been completed successfully. From this page, the guest is offered links onward to their bookings list and to the review-writing flow for the property just booked, closing the loop between payment and the eventual review stage of the guest journey. This page is intentionally simple, giving the guest a clear, unambiguous endpoint to the booking transaction rather than continuing to present booking-flow controls.

FIGURE_CAPTION: Figure 6.7: Booking Payment Success Page (BookingPaymentSuccessPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.8 My Bookings Page

`GuestBookingsPage.jsx` gives a guest an overview of all of their bookings. At the top of the page, a row of stat chips summarises the guest's booking activity across four counts: total bookings, bookings pending payment, bookings that need a review, and bookings already reviewed. Below the stat chips, a set of filter chips lets the guest narrow the list down to a particular subset matching one of those categories. The bookings themselves are presented as a grid of `GuestBookingCard` components, each showing the property's cover image, a badge indicating the timing of the stay, the total amount paid, and contextual action buttons that let the guest complete payment or write a review directly from the card, depending on the booking's current status. This page therefore functions as the guest's central hub for tracking every stage of their bookings after they have been created.

FIGURE_CAPTION: Figure 6.8: My Bookings Page (GuestBookingsPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.2.9 Offline Booking Request Page

For guests who prefer, or need, to arrange a stay without completing the online payment flow, `OfflineBookingPage.jsx` provides a form-based alternative. The page opens with a three-step explanation of how the offline process works, setting expectations before the guest reaches the form itself. The form collects the guest's name, phone number, location, intended start and end dates, room type, and a property selector. When the guest arrives at this page from a specific property's detail page, the property field is pre-filled automatically via a `propertyId` query parameter, sparing the guest from having to search for the property a second time. Once submitted, the request is queued for the property owner to review and respond to; guests can subsequently track the status of their submitted offline requests from their guest dashboard.

FIGURE_CAPTION: Figure 6.9: Offline Booking Request Page (OfflineBookingPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

## 6.3 Property Owner Interface

Property owners are the second principal actor in IARS. Once registered with the "owner" role, an owner's account gives access to a distinct set of dashboard screens for creating and maintaining property listings, uploading and tracking image verification, and responding to offline booking requests submitted by guests. This section documents the four screens that make up the owner's working area.

### 6.3.1 Owner Dashboard

`OwnerDashboard.jsx` is the landing screen for an owner after login, built on the shared `DashboardShell` layout used across role-specific dashboards. It presents quick-link cards for the owner's three primary tasks: viewing their properties, creating a new property, and managing offline requests. Beneath these quick links, the dashboard includes a preview card of the owner's most recent offline requests, giving a snapshot of pending guest enquiries without requiring a navigation to the dedicated offline requests page. This design allows an owner to orient themselves quickly on login and to move directly to whichever task needs attention.

FIGURE_CAPTION: Figure 6.10: Owner Dashboard (OwnerDashboard.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.3.2 Property Listing Management Page

`OwnerPropertiesPage.jsx` lists every property belonging to the signed-in owner as a set of property cards. Each card shows the property's cover image alongside two status indicators: a `PropertyStatusBadge`, reflecting whether the listing is pending, approved, or rejected by an administrator, and an `ImageVerificationBadge`, reflecting the aggregate verification state of the property's uploaded images. Where relevant, individual cards also surface contextual flags such as "waiting for approval" or "images under review", making it clear to the owner why a particular listing has not yet gone live and what, if anything, still needs to happen before it can be shown to guests. From this page, the owner can navigate onward to create a new listing or edit an existing one.

FIGURE_CAPTION: Figure 6.11: Property Listing Management Page (OwnerPropertiesPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.3.3 Create and Edit Property Form

Creating a new listing (`OwnerPropertyNewPage.jsx`) and editing an existing one (`OwnerPropertyEditPage.jsx`) both rely on the same shared `PropertyForm` component, ensuring a consistent editing experience regardless of whether the owner is starting from scratch or revising a live listing. The form is organised into a basic information section, a location section, a dynamic set of availability-calendar rows that the owner can add to or remove as needed to describe when the property is bookable, and an image-upload section supporting up to five images per property. When editing an existing property, each uploaded image additionally displays its current per-image verification status, letting the owner see exactly which photographs have been verified, are still pending review, or have been flagged, without having to visit a separate screen.

FIGURE_CAPTION: Figure 6.12: Create/Edit Property Form (OwnerPropertyNewPage.jsx / OwnerPropertyEditPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.3.4 Offline Request Management Page

`OwnerOfflineRequestsPage.jsx` presents the owner with the list of offline booking requests submitted by guests against their properties. Each pending request in the list is paired with a response textarea, allowing the owner to type a reply directly against that request, along with respond and close actions to submit that reply or mark the request as resolved. This page gives the owner a single place to work through incoming offline enquiries sequentially, without needing to correspond with guests through any channel outside the platform.

FIGURE_CAPTION: Figure 6.13: Offline Request Management Page (OwnerOfflineRequestsPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

## 6.4 Administrator Interface

The administrator role oversees the integrity of the platform as a whole: approving or rejecting submitted property listings, auditing uploaded images for authenticity, and managing user accounts. The four administrator screens described in this section are reached from the admin dashboard and share the same `DashboardLayout` sidebar navigation used by the other authenticated roles.

### 6.4.1 Admin Dashboard

`AdminDashboard.jsx` presents the administrator with three static task cards on login: Moderate Listings, Manage Users, and Image Audit. Rather than surfacing dynamic counts or previews, this dashboard acts as a simple, direct entry point into each of the administrator's three areas of responsibility, keeping the landing screen uncluttered and directing the administrator's attention to the specific workflow they intend to carry out next.

FIGURE_CAPTION: Figure 6.14: Admin Dashboard (AdminDashboard.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.4.2 Listing Moderation Page

`AdminListingsPage.jsx` presents the properties awaiting moderation in a pending-listings table or card list. Selecting a listing opens a detail panel showing its images together with their AI-generated verification scores, giving the administrator the evidence needed to make an approval decision. An Approve action is available from this panel, but it is deliberately blocked if the property has no verified image at all, and it triggers a confirmation dialog if any of the property's images remain unverified, ensuring that an administrator cannot approve a listing without at least being warned about, or prevented from proceeding past, unresolved image-verification concerns. A Reject action is also available for listings the administrator decides not to approve. This gate ties the listing-approval workflow directly to the outcome of image verification rather than treating the two as independent processes.

FIGURE_CAPTION: Figure 6.15: Listing Moderation Page (AdminListingsPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.4.3 Image Audit Page

`AdminImageAuditPage.jsx`, together with its `ImageAuditPropertyGroup` component, organises every uploaded property image into groups by property, so the administrator reviews photographs in the context of the listing they belong to rather than as an undifferentiated stream. An `ImageAuditStatsBar` sits above the grouped grid, offering filters for all, pending, verified, suspicious, and rejected images, so the administrator can focus on a particular subset of the image pool at a time. Each image in the grid is shown with an `AiScoreMeter` reflecting its automated verification score, alongside quick-action buttons allowing the administrator to mark the image as Verify, Suspicious, or Reject directly from the grid, without opening a separate detail view for each photograph.

FIGURE_CAPTION: Figure 6.16: Image Audit Page (AdminImageAuditPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

### 6.4.4 User Management Page

`AdminUsersPage.jsx` lists the platform's registered users, with role filter chips at the top of the page allowing the administrator to narrow the list to guests, owners, or administrators. Against each user, a verify or unverify toggle lets the administrator change that user's verification state directly from the list, without a separate edit screen. This page gives the administrator a compact but complete view of the user base and the single action — verification status — that they are responsible for managing over it.

FIGURE_CAPTION: Figure 6.17: User Management Page (AdminUsersPage.jsx)
FIGURE_PLACEHOLDER: SCREENSHOT

## 6.5 Multilingual and Theming Interface Elements

Two controls recur identically across every authenticated and public screen in IARS: the language switcher and the theme toggle. For unauthenticated and public pages, both controls are located in the `Navbar`, alongside the application logo, the Home and Search navigation links, and — depending on whether the visitor is signed in — either Dashboard, Login, and Register links, or a user menu with a logout option. For authenticated, role-specific screens, the same two controls reappear inside the `DashboardLayout` sidebar, positioned alongside a card showing the signed-in user's information and the sidebar's own logout action. Placing the language switcher and theme toggle in both navigation contexts ensures that a user is never more than one click away from changing either setting, regardless of which part of the application they are currently using.

The language switcher allows selection between English, Urdu, and Arabic. English is the default language for the interface, and its layout reads left to right. Selecting Urdu or Arabic switches the entire page to a right-to-left reading direction: navigation links, sidebar items, form labels and their associated inputs, and card content all mirror their horizontal ordering so that the natural reading flow of the selected language is preserved. Rather than relying on layout classes that hardcode a left or right position, the interface's components are built using direction-aware alignment such as start- and end-based positioning, which is what allows this mirroring to happen consistently across forms, tables, dashboards, the navbar, and the footer without any single component needing special-case logic for a particular language.

The theme toggle switches the interface between a light and a dark visual theme. This setting is independent of the language selection, so any of the three supported languages can be viewed in either theme. Because both controls are implemented once, in the shared navbar and sidebar components, their behaviour is uniform everywhere in the application — a change made on one screen persists as the user navigates to the next.

FIGURE_CAPTION: Figure 6.18: Language Switcher and Theme Toggle Controls
FIGURE_PLACEHOLDER: SCREENSHOT

## 6.6 Chapter Summary

This chapter has walked through every screen implemented in the IARS client application, organised by the three user roles the system serves. The guest interface takes a visitor from registration through search, property inspection, booking, payment, and post-stay review, with an offline form-based alternative available at every point where online payment is not the preferred path. The owner interface gives property owners a focused set of screens for managing listings, image uploads, and offline enquiries, while the administrator interface concentrates on listing moderation, image auditing, and user management. Running beneath all of these role-specific screens are the shared language and theming controls, which extend consistent multilingual, right-to-left-aware, and light/dark presentation to the entire application. Having established what the system looks like and how it behaves from the perspective of each user, the dissertation turns next to its concluding chapter, which reflects on the work completed, its limitations, and directions for future enhancement.
