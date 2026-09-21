import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "../hooks/usePublicSystemSettings";

type GeoItem = { id: string; name: string; code?: string };

interface Course {
  id: string;
  _id?: string;
  category_id: string;
  course_name: string;
  course_code: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  syllabus?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  backlog_fees_applicable?: boolean;
  backlog_fee_amount?: number;
  has_course_structure_units?: boolean;
  eligibility?: string;
  status: string;
  created_at: string;
  __categoryName?: string;
}

interface Category {
  id: string;
  _id?: string;
  name: string;
}

const ContactSection = () => {
  const { t } = useTranslation();
  const { data: systemSettings } = usePublicSystemSettings();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    categoryId: "",
    course: "",
    countryId: "",
    stateId: "",
    districtId: "",
    cityId: "",
    centerId: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<{ id?: string, _id?: string, name: string, code: string, country?: string, state?: string, district?: string, city?: string, location?: any }[]>([]);
  const [centerSearch, setCenterSearch] = useState("");
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [countryById, setCountryById] = useState<Record<string, string>>({});
  const [stateById, setStateById] = useState<Record<string, string>>({});
  const [districtById, setDistrictById] = useState<Record<string, string>>({});
  const [cityById, setCityById] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCenters();
    fetchCountries();
    fetchCategories();
    fetchCourses();
  }, []);

  const fetchCountries = async () => {
    try {
      const res = await fetch("/api/public/locations/countries");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCountries(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setCountryById(map);
      }
    } catch (err) {
      console.error("Failed to fetch countries", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/public/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/public/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch courses", err);
    }
  };

  const fetchStates = async (countryId: string) => {
    try {
      const res = await fetch(`/api/public/locations/states?country_id=${encodeURIComponent(countryId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setStates(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setStateById(map);
      }
    } catch (err) {
      console.error("Failed to fetch states", err);
    }
  };

  const fetchDistricts = async (stateId: string) => {
    try {
      const res = await fetch(`/api/public/locations/districts?state_id=${encodeURIComponent(stateId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setDistricts(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setDistrictById(map);
      }
    } catch (err) {
      console.error("Failed to fetch districts", err);
    }
  };

  const fetchCities = async (districtId: string) => {
    try {
      const res = await fetch(`/api/public/locations/cities?district_id=${encodeURIComponent(districtId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCities(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setCityById(map);
      }
    } catch (err) {
      console.error("Failed to fetch cities", err);
    }
  };

  const fetchCenters = async () => {
    try {
      // Add timestamp to prevent caching
      const res = await fetch(`/api/public/centers?t=${Date.now()}`);
      if (res.ok) {
        const result = await res.json();
        const data = result?.data || [];
        console.log("Fetched centers:", data);
        setCenters(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch centers", err);
    }
  };

  const safeCenters = Array.isArray(centers) ? centers : [];

  const filteredCourses = formData.categoryId
    ? courses.filter(c => c.category_id === formData.categoryId)
    : courses;

  const filteredCenters = safeCenters.filter(c => {
    const matchesSearch =
      centerSearch === "" ||
      (c.name && c.name.toLowerCase().includes(centerSearch.toLowerCase())) ||
      (c.code && c.code.toLowerCase().includes(centerSearch.toLowerCase()));

    let matchesCountry = true;
    if (formData.countryId && countryById[formData.countryId]) {
      const selected = countryById[formData.countryId].toLowerCase().trim();
      const centerVal = (c.country || c.location?.country || "").toLowerCase().trim();
      matchesCountry = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesState = true;
    if (formData.stateId && stateById[formData.stateId]) {
      const selected = stateById[formData.stateId].toLowerCase().trim();
      const centerVal = (c.state || c.location?.state || "").toLowerCase().trim();
      matchesState = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesDistrict = true;
    if (formData.districtId && districtById[formData.districtId]) {
      const selected = districtById[formData.districtId].toLowerCase().trim();
      const centerVal = (c.district || c.location?.district || "").toLowerCase().trim();
      matchesDistrict = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesCity = true;
    if (formData.cityId && cityById[formData.cityId]) {
      const selected = cityById[formData.cityId].toLowerCase().trim();
      const centerVal = (c.city || c.location?.city || "").toLowerCase().trim();
      matchesCity = centerVal.includes(selected) || selected.includes(centerVal);
    }

    return matchesSearch && matchesCountry && matchesState && matchesDistrict && matchesCity;
  });

  const handleCountryChange = (countryId: string) => {
    setFormData({
      ...formData,
      countryId,
      stateId: "",
      districtId: "",
      cityId: "",
      centerId: ""
    });
    if (countryId) {
      fetchStates(countryId);
    } else {
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  };

  const handleStateChange = (stateId: string) => {
    setFormData({
      ...formData,
      stateId,
      districtId: "",
      cityId: "",
      centerId: ""
    });
    if (stateId) {
      fetchDistricts(stateId);
    } else {
      setDistricts([]);
      setCities([]);
    }
  };

  const handleDistrictChange = (districtId: string) => {
    setFormData({
      ...formData,
      districtId,
      cityId: "",
      centerId: ""
    });
    if (districtId) {
      fetchCities(districtId);
    } else {
      setCities([]);
    }
  };

  const handleCityChange = (cityId: string) => {
    setFormData({
      ...formData,
      cityId,
      centerId: ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Basic validation
    const trimmedPhone = formData.phone.trim();
    if (!/^\d{10,15}$/.test(trimmedPhone)) {
      setError(t("Please enter a valid phone number (10-15 digits)"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: trimmedPhone,
          email: formData.email.trim() || undefined,
          category_id: formData.categoryId || undefined,
          course: formData.course,
          country_id: formData.countryId || undefined,
          state_id: formData.stateId || undefined,
          district_id: formData.districtId || undefined,
          city_id: formData.cityId || undefined,
          center_id: formData.centerId || undefined,
          message: formData.message.trim() || undefined,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
        setFormData({
          name: "",
          phone: "",
          email: "",
          categoryId: "",
          course: "",
          countryId: "",
          stateId: "",
          districtId: "",
          cityId: "",
          centerId: "",
          message: ""
        });
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || t("Failed to submit enquiry. Please try again."));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setError(t("An error occurred. Please try again later."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="section-padding bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block bg-accent/10 text-accent font-heading font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full border border-accent/20">
            {t("Get In Touch")}
          </span>
          <h2 className="font-heading font-extrabold text-2xl md:text-4xl text-foreground mt-4">
            {t("Contact Us / Enquiry Form")}
          </h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border">
            <h3 className="font-heading font-bold text-xl text-foreground mb-6">
              {t("Send Us Your Enquiry")}
            </h3>
            {submitted && (
              <div className="bg-secondary/10 text-secondary rounded-xl p-4 mb-6 font-semibold text-sm">
                ✅ {t("Thank you! We'll contact you soon.")}
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-xl p-4 mb-6 font-semibold text-sm">
                ❌ {t(error)}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                required
                placeholder={t("Your Full Name")}
                maxLength={100}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting || submitted}
              />
              <input
                type="tel"
                required
                placeholder={t("Phone Number")}
                maxLength={15}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSubmitting || submitted}
              />
              <input
                type="email"
                placeholder={t("Email Address (Optional)")}
                maxLength={255}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSubmitting || submitted}
              />
              <select
                required
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, course: "" })}
                disabled={isSubmitting || submitted}
              >
                <option value="">{t("Select Category")}</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.id || cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <select
                required
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                disabled={isSubmitting || submitted || !formData.categoryId}
              >
                <option value="">{t("Select Course")}</option>
                {filteredCourses.map((course) => (
                  <option key={course.id || course._id} value={course.course_name}>
                    {course.course_name}
                  </option>
                ))}
              </select>
              <select
                required
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.countryId}
                onChange={(e) => handleCountryChange(e.target.value)}
                disabled={isSubmitting || submitted}
              >
                <option value="">{t("Select Country")}</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.stateId}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={isSubmitting || submitted || !formData.countryId}
              >
                <option value="">{t("Select State")}</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.districtId}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={isSubmitting || submitted || !formData.stateId}
              >
                <option value="">{t("Select District")}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.cityId}
                onChange={(e) => handleCityChange(e.target.value)}
                disabled={isSubmitting || submitted || !formData.districtId}
              >
                <option value="">{t("Select City")}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("Search Center by Name or Code")}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={centerSearch}
                onChange={(e) => setCenterSearch(e.target.value)}
                disabled={isSubmitting || submitted}
              />
              <select
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.centerId}
                onChange={(e) => setFormData({ ...formData, centerId: e.target.value })}
                disabled={isSubmitting || submitted}
              >
                <option value="">{t("Select Center (Optional)")}</option>
                {filteredCenters.map((center) => (
                  <option key={center.id || center._id} value={center.id || center._id}>
                    {center.name} ({center.code})
                  </option>
                ))}
              </select>
              <textarea
                placeholder={t("Message (Optional)")}
                rows={3}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                disabled={isSubmitting || submitted}
              />

              <button
                type="submit"
                disabled={isSubmitting || submitted}
                className="w-full bg-gradient-to-r from-primary to-primary-dark text-primary-foreground px-6 py-4 rounded-xl font-heading font-bold text-base hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {isSubmitting ? t("Submitting...") : t("Submit Enquiry")}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border">
              <h3 className="font-heading font-bold text-xl text-foreground mb-6">
                {t("Contact Information")}
              </h3>
              <div className="space-y-5">
                <a href={`tel:${(systemSettings?.contact_phone as string) || "+919466317100"}`} className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-md">
                    <Phone className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t("Phone")}</p>
                    <p className="text-muted-foreground text-sm">{(systemSettings?.contact_phone as string) || "+91 94663 17100"}</p>
                  </div>
                </a>
                <a href={`mailto:${(systemSettings?.contact_email as string) || "info@screduc.com"}`} className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shrink-0 shadow-md">
                    <Mail className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t("Email")}</p>
                    <p className="text-muted-foreground text-sm">{(systemSettings?.contact_email as string) || "info@screduc.com"}</p>
                  </div>
                </a>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shrink-0 shadow-md">
                    <MapPin className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t("Address")}</p>
                    <p className="text-muted-foreground text-sm">
                      {(systemSettings?.contact_address as string) || "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-xl border border-border h-64">
              <iframe
                title={t("Location Map")}
                src={(systemSettings?.contact_map_url as string) || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3500!2d76.8!3d28.9!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDU0JzAwLjAiTiA3NsKwNDgnMDAuMCJF!5e0!3m2!1sen!2sin!4v1"}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
