import {
  Banknote,
  BedDouble,
  Briefcase,
  Building2,
  Car,
  Church,
  Cpu,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Landmark,
  Plane,
  ShoppingBag,
  Ship,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

function iconFor(slug: string, className?: string) {
  if (slug.includes("banking") || slug.includes("finance")) {
    return <Banknote className={className} aria-hidden="true" />;
  }
  if (slug.includes("government") || slug.includes("community")) {
    return <Landmark className={className} aria-hidden="true" />;
  }
  if (slug.includes("religion") || slug.includes("ngo")) {
    return <Church className={className} aria-hidden="true" />;
  }
  if (slug.includes("shipping") || slug.includes("travel")) {
    return <Ship className={className} aria-hidden="true" />;
  }
  if (slug.includes("transportation") || slug.includes("aviation")) {
    return <Plane className={className} aria-hidden="true" />;
  }
  if (slug.includes("restaurant") || slug.includes("cafe")) {
    return <UtensilsCrossed className={className} aria-hidden="true" />;
  }
  if (slug.includes("hotel") || slug.includes("accommodation")) {
    return <BedDouble className={className} aria-hidden="true" />;
  }
  if (slug.includes("retail") || slug.includes("shopping")) {
    return <ShoppingBag className={className} aria-hidden="true" />;
  }
  if (slug.includes("health") || slug.includes("medical")) {
    return <HeartPulse className={className} aria-hidden="true" />;
  }
  if (slug.includes("sport")) {
    return <Trophy className={className} aria-hidden="true" />;
  }
  if (slug.includes("fitness")) {
    return <Dumbbell className={className} aria-hidden="true" />;
  }
  if (slug.includes("beauty") || slug.includes("wellness")) {
    return <Sparkles className={className} aria-hidden="true" />;
  }
  if (slug.includes("automotive") || slug.includes("car")) {
    return <Car className={className} aria-hidden="true" />;
  }
  if (slug.includes("education") || slug.includes("training")) {
    return <GraduationCap className={className} aria-hidden="true" />;
  }
  if (slug.includes("real-estate")) {
    return <Building2 className={className} aria-hidden="true" />;
  }
  if (slug.includes("professional")) {
    return <Briefcase className={className} aria-hidden="true" />;
  }
  if (slug.includes("technology")) {
    return <Cpu className={className} aria-hidden="true" />;
  }
  if (slug.includes("entertainment") || slug.includes("leisure")) {
    return <Ticket className={className} aria-hidden="true" />;
  }
  if (slug.includes("home-services")) {
    return <Wrench className={className} aria-hidden="true" />;
  }
  return <Store className={className} aria-hidden="true" />;
}

export function CategoryIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  return iconFor(slug, className);
}
