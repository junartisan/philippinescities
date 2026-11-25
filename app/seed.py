from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import BlogCategory, Category, City, User, UserRole
from app.security import hash_password
from app.utils import unique_slug

DEFAULT_CATEGORIES = [
    ("Restaurants & Cafes", "Dining establishments, coffee shops, and food stalls"),
    ("Hotels & Accommodation", "Hotels, resorts, inns, and transient homes"),
    ("Retail & Shopping", "Stores, boutiques, and shopping centers"),
    ("Health & Medical", "Clinics, hospitals, pharmacies, and laboratories"),
    ("Beauty & Wellness", "Salons, spas, barbershops, and wellness centers"),
    ("Automotive", "Repair shops, dealerships, and car services"),
    ("Education & Training", "Schools, tutorial centers, and training providers"),
    ("Real Estate", "Brokers, developers, and property managers"),
    ("Professional Services", "Legal, accounting, and consulting services"),
    ("Technology", "IT services, software companies, and electronics"),
    ("Entertainment & Leisure", "Cinemas, recreation centers, and event venues"),
    ("Sports & Recreation", "Sports clubs, courts, fields, and recreational facilities"),
    ("Fitness Centers", "Gyms, training studios, and fitness classes"),
    ("Sports Equipment & Apparel", "Sports gear, uniforms, and equipment shops"),
    ("Sports Events & Venues", "Tournaments, leagues, stadiums, and event organizers"),
    ("Home Services", "Contractors, cleaning, and repair services"),
]

CATEGORY_GROUPS = [
    (
        "Accommodations and Hotels",
        "Hotels, resorts, suites, hostels, guest houses, and inns.",
        [
            "Hotels",
            "Resorts",
            "Suites",
            "Pension Houses",
            "Hostels",
            "Guest Houses and Inns",
        ],
    ),
    (
        "Automotive - Vehicles",
        "Vehicle sales, rentals, parts, accessories, and maintenance services.",
        [
            "Automotive Maintenance",
            "Bikes - Spare Parts & Accessories",
            "Car & Automobile - Garage",
            "Car & Automobile - Sales",
            "Car Rentals",
            "Motorbike Rentals",
            "Car Accessories",
            "Car Washing & Polishing Services",
            "Gasoline Service Stations",
            "Motorcycles - Sales",
            "Motorcycles - Spare Parts & Accessories",
        ],
    ),
    (
        "Banking & Finance",
        "Banks, money exchange, remittance, and traveller's cheque services.",
        [
            "Bank & Finance",
            "Money Exchange",
            "Money Transfer Services",
            "Travellers' Cheques",
        ],
    ),
    (
        "Beauty",
        "Salons, cosmetics, optical lenses, cosmetic surgery, and spas.",
        [
            "Beauty Salon Equipment & Supplies",
            "Beauty Salons",
            "Cosmetic Surgery",
            "Cosmetics & Personal Care",
            "Lenses - Optical",
            "Saunas & Spas",
        ],
    ),
    (
        "Business & Companies",
        "Professional, industrial, corporate, and general business services.",
        [
            "Accountants - General",
            "Advertising - Internet",
            "Advertising Agencies & Consultants",
            "Agricultural Development",
            "Architectural Services",
            "Billboards - Design & Advertising",
            "Cakes and Pastries",
            "Call Centers and BPO",
            "Commercial & Industrial Equipment",
            "Computer Programming Consultants",
            "Dive Centers",
            "Engineering - Contractors & Consultants",
            "Engineers - Civil",
            "Engineers - Marine",
            "Funeral Services",
            "Gadgets & Electronics",
            "Geographical Services",
            "Hospitals",
            "Internet Service Providers & Consultants",
            "Investment Companies",
            "Labor Contractors - Employment",
            "Laundry & Dry Cleaners",
            "Law Offices",
            "Manufacturers",
            "Water Suppliers",
        ],
    ),
    (
        "Education and Trainings",
        "Schools, universities, training centers, and learning support services.",
        [
            "Accounting Classes & Training",
            "Advertising (Google)",
            "Computer Schools & Training",
            "Graphic Design",
            "Dive Centre",
            "Driving Schools & Instructors",
            "Health Education Centres",
            "Kindergartens",
            "Schools & Educational - Private",
            "Schools & Educational - Public",
            "Training Programs",
            "Universities",
            "Training Rooms",
        ],
    ),
    (
        "Entertainments",
        "Nightlife, attractions, event venues, and recreational entertainment.",
        [
            "Bars & Pubs",
            "Boat Excursions - Rental",
            "Casino",
            "Cinemas & Movie Centres",
            "Conference Rooms & Organizers",
            "Event Management",
            "Golf - Clubs & Driving Ranges",
            "Night Clubs",
            "Shopping Centres",
            "Swimming Pools",
            "Video Games - Entertainment",
        ],
    ),
    (
        "Governments & Community",
        "Government offices, public services, and community facilities.",
        [
            "Agricultural",
            "City Fire Stations",
            "City Health Department",
            "City Police Stations",
            "LTO",
            "City Mayor Office",
            "Dept. of Public Services",
            "National Irrigation Administration",
        ],
    ),
    (
        "Health and Medicine",
        "Medical specialists, clinics, hospitals, emergency care, and health services.",
        [
            "Allergist",
            "Ambulance Service",
            "Anesthesiologist",
            "Aromatherapy",
            "Audiologist",
            "Blood Banks & Centres",
            "Cardiologist",
            "Clinics - Medical & General Practitioners",
            "Counseling Services - Psychologists & Psychiatrists",
            "Dental Clinics & Practitioners",
            "Dermatologists",
            "Diabetologist",
            "Emergency - Medical",
            "Endocrinologist",
            "Evacuation & Repatriation - Medical",
            "Family Practice Physician",
            "Forensic Physician",
            "Gastroenterologist",
            "Gastrointestinal Surgeon",
            "General Practitioner",
        ],
    ),
    (
        "Religion & NGO",
        "Religious facilities, foundations, and non-government organizations.",
        ["Buddhist Facilities", "Churches & Religions", "Foundations", "Temples"],
    ),
    (
        "Restaurants and Bars",
        "Restaurants, cafes, fast food, and dining by cuisine.",
        [
            "Asian Restaurants",
            "BBQ Restaurants",
            "Cafes & Coffee Shops",
            "Chinese Restaurants",
            "Fast Food",
            "Filipino Restaurants",
            "French Restaurants",
            "German Restaurants",
            "Greek Restaurants",
            "Halal Restaurants",
            "Italian Restaurants",
            "Japanese Restaurants",
            "Korean Restaurants",
            "Malaysian Restaurants",
            "Mediterranean Restaurants",
            "Mexican Restaurants",
        ],
    ),
    (
        "Shipping, Transportation, Travel",
        "Air, sea, land, courier, postal, and travel services.",
        [
            "Aircraft Charter & Rental Services",
            "Airline Companies",
            "Aviation - Civil Authority",
            "Boat Transportation - Rental",
            "Cargo - Transit",
            "Container Depot",
            "Courier Services",
            "Port Authorities & Representatives",
            "Ferry Boats",
            "Postal Services",
            "Shipping Line Services & Agencies",
            "Travel Agencies",
            "Visa Services",
        ],
    ),
    (
        "Shopping",
        "Retail shops, markets, specialty stores, and wholesale suppliers.",
        [
            "Bags & Suitcases Retailers & Wholesalers",
            "Cameras - Retail",
            "Clothing Store",
            "Computer - Equipment, Maintenance & Consultancy",
            "Diamond - Wholesales & Retails",
            "Drink Shops",
            "Duty Free Shops",
            "Flower Shop",
            "Handicrafts",
            "Hardware Stores",
            "Lingerie & Underwear Wholesales & Retails",
            "Markets - Shops",
            "Perfumes",
            "Tents - Retailers",
            "Toys",
        ],
    ),
]

DEFAULT_BLOG_CATEGORIES = [
    ("Local news", "Updates and announcements from around the city"),
    ("City guides", "Practical guides for residents and visitors"),
    ("Food & dining", "Restaurants, cafes, and local flavors"),
    ("Things to do", "Activities, attractions, and weekend ideas"),
    ("Business features", "Profiles of local businesses and entrepreneurs"),
    ("Sports", "Sports news, teams, events, and athlete stories"),
    ("Community stories", "People, places, and stories from the community"),
]

DEFAULT_CITIES = [
    ("Quezon City", "Metro Manila", "National Capital Region"),
    ("Manila", "Metro Manila", "National Capital Region"),
    ("Makati", "Metro Manila", "National Capital Region"),
    ("Pasig", "Metro Manila", "National Capital Region"),
    ("Taguig", "Metro Manila", "National Capital Region"),
    ("Cebu City", "Cebu", "Central Visayas"),
    ("Mandaue", "Cebu", "Central Visayas"),
    ("Lapu-Lapu", "Cebu", "Central Visayas"),
    ("Davao City", "Davao del Sur", "Davao Region"),
    ("Baguio", "Benguet", "Cordillera Administrative Region"),
    ("Iloilo City", "Iloilo", "Western Visayas"),
    ("Bacolod", "Negros Occidental", "Western Visayas"),
    ("Cagayan de Oro", "Misamis Oriental", "Northern Mindanao"),
    ("General Santos", "South Cotabato", "SOCCSKSARGEN"),
    ("Dagupan", "Pangasinan", "Ilocos Region"),
    ("Naga", "Camarines Sur", "Bicol Region"),
    ("Tacloban", "Leyte", "Eastern Visayas"),
    ("Zamboanga City", "Zamboanga del Sur", "Zamboanga Peninsula"),
]


def _ensure_category(
    db: Session,
    name: str,
    description: str,
    parent_id: int | None = None,
) -> Category:
    category = db.scalar(
        select(Category).where(func.lower(Category.name) == name.lower())
    )
    if category is None:
        category = Category(
            name=name,
            slug=unique_slug(db, Category, name),
            description=description,
            parent_id=parent_id,
        )
        db.add(category)
        db.flush()
    elif parent_id is not None and category.parent_id is None:
        category.parent_id = parent_id
    return category


def seed_directory(db: Session) -> None:
    for name, description in DEFAULT_CATEGORIES:
        exists = db.scalar(
            select(Category.id).where(func.lower(Category.name) == name.lower())
        )
        if exists is None:
            db.add(
                Category(
                    name=name,
                    slug=unique_slug(db, Category, name),
                    description=description,
                )
            )
    for parent_name, description, children in CATEGORY_GROUPS:
        parent = _ensure_category(db, parent_name, description)
        for child_name in children:
            _ensure_category(db, child_name, f"{child_name} in {parent_name}.", parent.id)
    for name, description in DEFAULT_BLOG_CATEGORIES:
        exists = db.scalar(
            select(BlogCategory.id).where(
                func.lower(BlogCategory.name) == name.lower()
            )
        )
        if exists is None:
            db.add(
                BlogCategory(
                    name=name,
                    slug=unique_slug(db, BlogCategory, name),
                    description=description,
                )
            )
    for name, province, region in DEFAULT_CITIES:
        exists = db.scalar(
            select(City.id).where(
                func.lower(City.name) == name.lower(),
                func.coalesce(func.lower(City.province), "") == province.lower(),
            )
        )
        if exists is None:
            db.add(
                City(
                    name=name,
                    province=province,
                    region=region,
                    slug=unique_slug(db, City, f"{name} {province}"),
                )
            )
    db.commit()


def bootstrap_admin(db: Session) -> None:
    if not settings.admin_email or not settings.admin_password:
        return
    email = settings.admin_email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            hashed_password=hash_password(settings.admin_password),
            full_name="Administrator",
            role=UserRole.admin,
        )
        db.add(user)
    elif user.role != UserRole.admin:
        user.role = UserRole.admin
    db.commit()
