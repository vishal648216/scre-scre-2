import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import CoursesSection from "@/components/CoursesSection";
import WhyChooseUs from "@/components/WhyChooseUs";
import CounterSection from "@/components/CounterSection";
import PlacementsSection from "@/components/PlacementsSection";
import GallerySection from "@/components/GallerySection";
import AdmissionProcess from "@/components/AdmissionProcess";
import CTASection from "@/components/CTASection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import AdmissionOpenModal from "@/components/AdmissionOpenModal";
import TeachersSection from "@/components/TeachersSection";
import ArticlesSection from "@/components/ArticlesSection"
import StudentSection from "@/components/StudentSection";
import UniversitiesSection from "@/components/UniversitiesSection";
import OurPartnersSection from "@/components/OurPartnersSection";

import { useHomeData } from "@/hooks/useHomeData";

const Index = () => {
  const { data: homeData, isLoading } = useHomeData();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <CounterSection stats={homeData?.stats} />
        <CoursesSection />
        {/* <AboutSection /> */}
        <WhyChooseUs />
        <TeachersSection />
        <AdmissionProcess />
        <GallerySection />
        <ArticlesSection/>
        <StudentSection />
        <UniversitiesSection />
        <PlacementsSection />
        <OurPartnersSection/>
        <CTASection />
        <ContactSection />
      </main>
      <Footer />
      <WhatsAppButton />
      <AdmissionOpenModal />
    </div>
  );
};

export default Index;
