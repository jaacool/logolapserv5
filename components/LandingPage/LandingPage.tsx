import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ZapIcon, LayersIcon, ImageIcon, CheckCircleIcon } from 'lucide-react';
import { HeroAnimation } from './HeroAnimation';
import { JaaCoolMediaLogo } from '../Icons';

interface LandingPageProps {
  onStart: () => void;
  isLoggedIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, isLoggedIn }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <JaaCoolMediaLogo className="w-8 h-8 text-indigo-500" />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              LogoLapser
            </span>
          </div>
          <button
            onClick={onStart}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors shadow-lg shadow-indigo-500/20"
          >
            {isLoggedIn ? 'Go to App' : 'Get Started'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                Automate your <br className="hidden lg:block" />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                  logo placements
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Stop manually placing your logo on hundreds of product images. 
                Upload a master, drop your targets, and let our computer vision algorithm align, scale, and correct perspective automatically.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={onStart}
                  className="group px-8 py-4 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                >
                  Start Processing Now
                  <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href="#how-it-works"
                  className="px-8 py-4 text-base font-medium text-gray-300 bg-gray-800/50 hover:bg-gray-800 hover:text-white border border-gray-700 rounded-full transition-colors flex items-center justify-center"
                >
                  Learn More
                </a>
              </div>

              <div className="mt-10 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  <span>Free draft mode</span>
                </div>
              </div>
            </motion.div>

            {/* Animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative lg:h-[500px] flex items-center justify-center"
            >
              <HeroAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features / How it works */}
      <section id="how-it-works" className="py-24 bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How LogoLapser Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Our advanced OpenCV pipeline analyzes your images in real-time, right in your browser.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<ImageIcon className="w-6 h-6 text-indigo-400" />}
              title="1. Upload Master"
              description="Provide one reference image where your logo is perfectly placed. We extract the key features and perspective."
              delay={0.1}
            />
            <FeatureCard 
              icon={<LayersIcon className="w-6 h-6 text-purple-400" />}
              title="2. Drop Targets"
              description="Upload hundreds of target images. Our algorithm detects the same surface features in the new images."
              delay={0.2}
            />
            <FeatureCard 
              icon={<ZapIcon className="w-6 h-6 text-amber-400" />}
              title="3. Auto-Align"
              description="Logos are automatically warped, scaled, and placed exactly where they belong on the new images."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Pro Features Callout */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Need more than just alignment?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Unlock <span className="text-white font-semibold">Pro Mode</span> for AI-powered Edge Fill to expand cropped images, and generate stunning AI variations of your products using Google Gemini.
          </p>
          <button
            onClick={onStart}
            className="px-8 py-4 text-base font-semibold text-gray-900 bg-white hover:bg-gray-100 rounded-full transition-colors shadow-xl shadow-white/10"
          >
            Try LogoLapser App
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} jaa.cool Media GmbH & Co. KG. All rights reserved.</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
      className="bg-gray-800/30 border border-gray-700/50 p-8 rounded-2xl hover:bg-gray-800/50 transition-colors"
    >
      <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-6 shadow-inner border border-gray-700">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-100">{title}</h3>
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};
