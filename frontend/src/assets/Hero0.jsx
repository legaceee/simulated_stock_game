import growwhero from "../../public/growwhero.png";
import Button from "./Component/Button";
function Hero0() {
  return (
    <>
      <div className="flex flex-col justify-center mt-6 sm:mt-10 text-center bg-white">
        <h2 className="text-4xl sm:text-5xl lg:text-[75px] font-semibold text-slate-700 leading-tight">
          All things finance,
          <br /> Right here!
        </h2>
        <h1 className="decoration-slate-400 text-base sm:text-xl text-slate-700 mt-2">
          Built for growing india
        </h1>
      </div>
      <div className="flex items-center justify-center mt-3">
        <Button>Get Started</Button>
      </div>
      <div>
        <img
          src={growwhero}
          alt="Groww Hero"
          className="w-full mt-3 object-contain"
        />
      </div>
      <div className="flex flex-col items-center justify-center mt-10">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-semibold text-slate-700 mb-4">
            {" "}
            best brokerage
          </h2>
          <p className="text-base sm:text-lg text-slate-600 text-center max-w-2xl">
            Invest in stocks, mutual funds, and more with the best brokerage
            rates.
          </p>
        </div>
      </div>
    </>
  );
}

export default Hero0;
