// ===== COLLABORATIVE DRAWING BOARD =====
// I'm building a collaborative drawing app with React, Supabase, and Tailwind CSS!
// This file is my main component. I'm adding comments as I learn, so future me (or anyone else) can follow my journey.

// REACT IMPORTS: These are the core hooks and tools from React.
// useState: lets me store and update values that change (like color, user, etc.)
// useRef: gives me a way to reference DOM elements (like the canvas)
// useEffect: lets me run code when things change or when the component loads
import React, { useState, useRef, useEffect } from 'react';
import { Palette, Users, Save, Trash2, Download, LogIn, LogOut, UserPlus, Moon, Sun } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// SUPABASE SETUP: This connects my app to my Supabase backend.
// I use environment variables so my keys are never hardcoded.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ===== MAIN REACT COMPONENT =====
// This is the main block of my app. All the logic and UI lives here.
const DrawingBoard = () => {
  // ===== STATE MANAGEMENT =====
  // I use useState for all the things that change in my app:
  // - isDrawing: am I currently drawing?
  // - currentColor: what color is selected?
  // - brushSize: how big is my brush?
  // - user: who's signed in?
  // - users: list of users (future: for real-time collab)
  // - savedDrawings: list of saved drawings
  // - currentDrawingId: which drawing is active
  // - isLoading: is something loading?
  // - message: status messages for the user
  // - authMode: 'signin' or 'signup' for the auth form
  // - email/password: for the auth form
  // - showAuthDropdown: is the auth dropdown open?
  // - imageLoaded: is an image loaded for editing?
  // - brightness/contrast: image adjustment sliders
  // - darkMode: is dark mode enabled?
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [savedDrawings, setSavedDrawings] = useState([]);
  const [currentDrawingId, setCurrentDrawingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const authDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // COLOR PALETTE: These are my preset colors.
  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // ===== LIFECYCLE: useEffect =====
  // This runs when the component loads. I set up the canvas and check for a logged-in user.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (data && data.user) {
        setUser(data.user);
        loadSavedDrawings();
        createNewDrawing();
      }
    }
    fetchUser();
  }, []);

  // This effect closes the auth dropdown if you click outside it.
  useEffect(() => {
    function handleClickOutside(event) {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target)) {
        setShowAuthDropdown(false);
      }
    }
    if (showAuthDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAuthDropdown]);

  // This effect toggles dark mode on the <html> element and saves it to localStorage.
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // This effect auto-hides messages after 3 seconds.
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ===== AUTHENTICATION =====
  // Handles sign in, sign up, and sign out using Supabase Auth.
  const signIn = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      setMessage('Signed in successfully! 🎉');
      setEmail('');
      setPassword('');
      setShowAuthDropdown(false);
      await loadSavedDrawings();
      await createNewDrawing();
    } catch (error) {
      setMessage('Error signing in: ' + error.message);
    }
    setIsLoading(false);
  };
  const signUp = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMessage('Sign up successful! Please check your email to confirm your account, then sign in.');
      setAuthMode('signin');
      setEmail('');
      setPassword('');
      setShowAuthDropdown(false);
    } catch (error) {
      setMessage('Error signing up: ' + error.message);
    }
    setIsLoading(false);
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage('Error signing out: ' + error.message);
      return;
    }
    setUser(null);
    setSavedDrawings([]);
    setCurrentDrawingId(null);
    clearCanvas();
    setMessage('Signed out successfully');
  };

  // ===== DATABASE FUNCTIONS =====
  // These talk to Supabase to load, save, and create drawings.
  const loadSavedDrawings = async () => {
    try {
      const { data: drawings, error } = await supabase
        .from('drawings')
        .select('id, name, created_at, canvas_data')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedDrawings(drawings || []);
    } catch (error) {
      setMessage('Error loading drawings: ' + error.message);
    }
  };
  const createNewDrawing = async () => {
    if (!user) return;
    try {
      const { data: newDrawing, error } = await supabase
        .from('drawings')
        .insert({
          name: `Drawing ${Date.now()}`,
          is_public: true,
          created_by: user.id
        })
        .select()
        .single();
      if (error) throw error;
      setCurrentDrawingId(newDrawing.id);
      setMessage(`New drawing created! ID: ${newDrawing.id}`);
    } catch (error) {
      setMessage('Error creating drawing: ' + error.message);
      const tempId = 'temp-' + Date.now();
      setCurrentDrawingId(tempId);
    }
  };
  const saveDrawingToDb = async (dataURL, name) => {
    if (!currentDrawingId) return;
    try {
      const { error } = await supabase
        .from('drawings')
        .update({ canvas_data: dataURL, name: name || `Drawing ${Date.now()}` })
        .eq('id', currentDrawingId);
      if (error) throw error;
      setMessage('Drawing saved to database! 💾');
      loadSavedDrawings();
    } catch (error) {
      setMessage('Error saving drawing');
    }
  };
  const loadDrawing = async (drawingId) => {
    try {
      const { data: drawing, error } = await supabase
        .from('drawings')
        .select('canvas_data')
        .eq('id', drawingId)
        .single();
      if (error) throw error;
      if (drawing && drawing.canvas_data) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          clearCanvas();
          ctx.drawImage(img, 0, 0);
        };
        img.src = drawing.canvas_data;
        setCurrentDrawingId(drawingId);
        setMessage('Drawing loaded! 🎨');
      }
    } catch (error) {
      setMessage('Error loading drawing');
    }
  };

  // ===== DRAWING FUNCTIONS =====
  // These handle the actual drawing on the canvas.
  const startDrawing = (e) => {
    if (!user) {
      setMessage('Please sign in to start drawing!');
      return;
    }
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = async (e) => {
    if (!isDrawing || !user) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
    try {
      await supabase
        .from('drawing_strokes')
        .insert({
          drawing_id: currentDrawingId,
          user_id: user.id,
          x: Math.round(x),
          y: Math.round(y),
          color: currentColor,
          brush_size: brushSize
        });
    } catch (error) {
      // In a real app, handle errors here
    }
  };
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const saveDrawing = async () => {
    if (!user) {
      setMessage('Please sign in first!');
      return;
    }
    try {
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL();
      const name = prompt('Enter a name for your drawing:') || `Drawing ${Date.now()}`;
      const { data: newDrawing, error } = await supabase
        .from('drawings')
        .insert({
          name: name,
          is_public: true,
          canvas_data: dataURL,
          created_by: user.id
        })
        .select()
        .single();
      if (error) throw error;
      setMessage('Drawing saved successfully! 🎨');
      setCurrentDrawingId(newDrawing.id);
      await loadSavedDrawings();
    } catch (error) {
      setMessage('Error saving drawing: ' + error.message);
    }
  };
  const downloadDrawing = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'my-drawing.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  // ===== IMAGE UPLOAD & EDITING =====
  // This lets users upload an image and use basic editing tools.
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageLoaded(true);
        setBrightness(100);
        setContrast(100);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  // Crop: crops to the center square for demo
  const handleCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = Math.min(canvas.width, canvas.height);
    const imageData = ctx.getImageData((canvas.width-size)/2, (canvas.height-size)/2, size, size);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  };
  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(tempCanvas, -tempCanvas.height / 2, -tempCanvas.width / 2);
    ctx.restore();
  };
  // Brightness/Contrast
  const handleAdjust = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const b = brightness / 100;
    const c = contrast / 100;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * b);
      data[i+1] = Math.min(255, data[i+1] * b);
      data[i+2] = Math.min(255, data[i+2] * b);
      data[i] = ((data[i] - 128) * c + 128);
      data[i+1] = ((data[i+1] - 128) * c + 128);
      data[i+2] = ((data[i+2] - 128) * c + 128);
    }
    ctx.putImageData(imageData, 0, 0);
  };
  // Reset image adjustments
  const handleResetImage = () => {
    setBrightness(100);
    setContrast(100);
    setImageLoaded(false);
    clearCanvas();
  };

  // ===== RENDER =====
  // This is the main UI. I use Tailwind for styling and dark mode classes for full dark mode support.
  return (
    <div className={
      `min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 dark:from-gray-900 dark:to-gray-800`
    }>
      <div className="max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Collaborative Drawing Board</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user ? `Welcome, ${user.email}!` : 'Sign in to start drawing'}
                </p>
              </div>
            </div>
            {/* DARK MODE TOGGLE */}
            <button
              onClick={() => setDarkMode(d => !d)}
              className="mr-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* AUTHENTICATION BUTTONS OR DROPDOWN */}
            <div className="flex items-center gap-3 relative">
              {!user && (
                <>
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-l-lg text-sm font-medium ${authMode === 'signin' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'} shadow hover:bg-blue-600 transition-colors`}
                    onClick={() => {
                      setAuthMode('signin');
                      setShowAuthDropdown((prev) => authMode !== 'signin' || !prev);
                    }}
                  >
                    <LogIn className="inline w-4 h-4 mr-1" /> Sign In
                  </button>
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-r-lg text-sm font-medium ${authMode === 'signup' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'} shadow hover:bg-green-600 transition-colors`}
                    onClick={() => {
                      setAuthMode('signup');
                      setShowAuthDropdown((prev) => authMode !== 'signup' || !prev);
                    }}
                  >
                    <UserPlus className="inline w-4 h-4 mr-1" /> Sign Up
                  </button>
                  {/* DROPDOWN FORM */}
                  {showAuthDropdown && (
                    <div
                      ref={authDropdownRef}
                      className="absolute left-0 top-full w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 sm:p-6 z-50 animate-dropdown-bubble"
                      style={{ minWidth: '16rem' }}
                    >
                      <input
                        type="email"
                        placeholder="Email"
                        className="w-full mb-2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 text-base sm:text-sm"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        className="w-full mb-4 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 text-base sm:text-sm"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      {authMode === 'signin' ? (
                        <button
                          onClick={signIn}
                          disabled={isLoading}
                          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-base sm:text-sm"
                        >
                          {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                      ) : (
                        <button
                          onClick={signUp}
                          disabled={isLoading}
                          className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-base sm:text-sm"
                        >
                          {isLoading ? 'Signing up...' : 'Sign Up'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              {user && (
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">
                    {user.email[0].toUpperCase()}
                  </div>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* MESSAGE DISPLAY */}
          {message && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-100">
              {message}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* TOOLBAR SIDEBAR/BOTTOMBAR (responsive, now left on desktop) */}
          <div className="lg:col-span-1 order-2 lg:order-none">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 space-y-4 flex flex-col lg:block fixed bottom-0 left-0 right-0 z-40 lg:static lg:rounded-lg lg:shadow-lg lg:p-4 lg:space-y-4 overflow-x-auto lg:overflow-visible" style={{maxWidth: '100vw'}}>
              {/* Live Color Preview */}
              <div className="flex justify-center mb-2 lg:mb-4">
                <div className="w-12 h-12 rounded-full border-4 border-gray-300 dark:border-gray-700 shadow-inner" style={{ backgroundColor: currentColor }} />
              </div>
              {/* COLOR PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Colors</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setCurrentColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 ${
                        currentColor === color ? 'border-gray-800 dark:border-gray-100' : 'border-gray-200 dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {/* Color Picker Circle */}
                  <label className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer bg-white dark:bg-gray-800 hover:border-gray-500 dark:hover:border-gray-400 transition-colors">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={e => setCurrentColor(e.target.value)}
                      className="w-8 h-8 rounded-full border-none p-0 cursor-pointer bg-transparent"
                      style={{ appearance: 'none' }}
                    />
                  </label>
                </div>
              </div>
              {/* BRUSH SIZE SLIDER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Brush Size: {brushSize}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              {/* DRAWING ACTIONS */}
              <div className="space-y-2">
                <button
                  onClick={saveDrawing}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Drawing
                </button>
                <button
                  onClick={downloadDrawing}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={clearCanvas}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Canvas
                </button>
                {/* Upload Image Button */}
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                  disabled={!user}
                  title={!user ? 'Sign in to upload an image' : ''}
                >
                  Upload Image
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {/* Image Editing Tools */}
                <div className="space-y-2 pt-2">
                  <div className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-1">Image Tools</div>
                  <button
                    onClick={handleCrop}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    disabled={!imageLoaded}
                  >
                    Crop (center square)
                  </button>
                  <button
                    onClick={handleRotate}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    disabled={!imageLoaded}
                  >
                    Rotate 90°
                  </button>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-300">Brightness</label>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={brightness}
                      onChange={e => setBrightness(Number(e.target.value))}
                      onMouseUp={handleAdjust}
                      onTouchEnd={handleAdjust}
                      disabled={!imageLoaded}
                      className="flex-1"
                    />
                    <span className="text-xs w-8 text-right">{brightness}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-300">Contrast</label>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={contrast}
                      onChange={e => setContrast(Number(e.target.value))}
                      onMouseUp={handleAdjust}
                      onTouchEnd={handleAdjust}
                      disabled={!imageLoaded}
                      className="flex-1"
                    />
                    <span className="text-xs w-8 text-right">{contrast}</span>
                  </div>
                  <button
                    onClick={handleResetImage}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    disabled={!imageLoaded}
                  >
                    Reset Image
                  </button>
                </div>
              </div>
            </div>
            {/* SAVED DRAWINGS LIST */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 mt-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-3">Your Saved Drawings</h3>
              {!user ? (
                <p className="text-sm text-gray-500">Sign in to see your saved drawings</p>
              ) : savedDrawings.length === 0 ? (
                <p className="text-sm text-gray-500">No saved drawings yet</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {savedDrawings.map(drawing => (
                    <div 
                      key={drawing.id}
                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => loadDrawing(drawing.id)}
                    >
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{drawing.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(drawing.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* DRAWING CANVAS */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4">
              <canvas
                ref={canvasRef}
                className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingBoard;