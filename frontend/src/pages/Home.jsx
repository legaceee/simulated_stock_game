import GuestNavbar from "../assets/Component/GuestNavbar";
import AuthNavbar from "../assets/Component/AuthNavbar";
import Footer from "../assets/Component/Footer";
import Hero1 from "../assets/Component/Hero1";
import Hero2 from "../assets/Component/Hero2";
import Hero3 from "../assets/Component/Hero3";
import Hero4 from "../assets/Component/Hero4";
import Hero0 from "../assets/Hero0";
import { useAuth } from "../../Context/AuthContext";

function Home() {
  const { user } = useAuth();
  return (
    <>
      <div className="flex flex-col min-h-screen bg-white">
        {user ? <AuthNavbar /> : <GuestNavbar />}
        <main className="w-full pt-28 md:pt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Hero0 />
          </div>
        </main>
      </div>

      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Hero1 />
        </div>
      </section>

      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Hero2 />
        </div>
      </section>

      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Hero3 />
        </div>
      </section>

      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Hero4 />
        </div>
      </section>

      <Footer />
    </>
  );
}

export default Home;
