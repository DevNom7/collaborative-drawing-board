// ===== COLLABORATIVE DRAWING BOARD =====
// Hey! I'm building a drawing app where multiple people can draw together
// This is my first time using React and Supabase, so I'm documenting my learning journey

// REACT IMPORTS: I learned that these are like importing tools from a toolbox
// useState helps me remember things that can change (like colors and brush sizes)
// useRef gives me direct access to HTML elements (like the canvas)
// useEffect lets me run code when things change (like when the page loads)
import React, { useState, useRef, useEffect } from 'react';
import { Palette, Users, Save, Trash2, Download, LogIn, LogOut } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Setting up Supabase - this is my first time using a real database!
// I learned that environment variables keep my secret keys safe
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ===== MAIN REACT COMPONENT =====
// I learned that components are like LEGO blocks - reusable pieces of UI
// This is my main component that handles everything
const DrawingBoard = () => {
  // ===== STATE MANAGEMENT =====
  // I use useState to remember things that can change:
  // - isDrawing: am I currently drawing? (true/false)
  // - currentColor: what color am I using? (like '#000000' for black)
  // - brushSize: how big is my brush? (like 5 pixels)
  // - user: who's logged in? (null if no one)
  // - users: who's currently drawing? (list of users)
  // - savedDrawings: what drawings have I saved? (list of drawings)
  // - currentDrawingId: which drawing am I working on? (null if new)
  // - isLoading: is something happening? (true/false)
  // - message: what should I tell the user? (like "Drawing saved!")
  
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

  // These are the colors I can choose from
  const colors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // ===== REACT LIFECYCLE =====
  // I learned that useEffect runs code when the component first loads
  // This is like saying "when the page is ready, do this stuff"
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Make the canvas fill its container
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Set up how the brush should look
    ctx.lineCap = 'round'; // Makes the brush tips round
    ctx.lineJoin = 'round'; // Makes line connections smooth
    
    // Check if someone was already logged in
    const existingUser = supabase.getUser();
    if (existingUser) {
      setUser(existingUser);
      loadSavedDrawings();
      createNewDrawing();
    }
  }, []); // Empty array means "only run once when the page loads"

  // ===== AUTHENTICATION FUNCTIONS =====
  // I learned that async/await is like saying "wait for this to finish"
  // This helps when talking to the server because it takes time
  const signIn = async () => {
    setIsLoading(true);
    try {
      // Try to log in with the test account
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: 'anonymous@demo.com',
        password: 'anonymous'
      });
      
      if (error) throw error;
      
      setUser(user);
      setMessage('Signed in successfully! 🎉');
      await loadSavedDrawings();
      await createNewDrawing();
    } catch (error) {
      setMessage('Error signing in: ' + error.message);
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
  // I learned that databases store data permanently
  // This is different from variables that disappear when you refresh
  const loadSavedDrawings = async () => {
    try {
      // Get all drawings from the database, newest first
      const { data: drawings, error } = await supabase
        .from('drawings')
        .select('id, name, created_at, canvas_data')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSavedDrawings(drawings || []);
    } catch (error) {
      console.error('Error loading drawings:', error);
      setMessage('Error loading drawings: ' + error.message);
    }
  };

  const createNewDrawing = async () => {
    if (!user) return;
    
    try {
      // Create a new drawing in the database
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
      console.error('Error creating drawing:', error);
      setMessage('Error creating drawing: ' + error.message);
      const tempId = 'temp-' + Date.now();
      setCurrentDrawingId(tempId);
    }
  };

  const saveDrawingToDb = async (dataURL, name) => {
    if (!currentDrawingId) return;
    
    try {
      // Update the drawing in the database
      const { error } = await supabase
        .from('drawings')
        .update({ 
          canvas_data: dataURL,
          name: name || `Drawing ${Date.now()}`
        })
        .eq('id', currentDrawingId);

      if (error) throw error;
      
      setMessage('Drawing saved to database! 💾');
      loadSavedDrawings();
    } catch (error) {
      console.error('Error saving drawing:', error);
      setMessage('Error saving drawing');
    }
  };

  const loadDrawing = async (drawingId) => {
    try {
      // Get a specific drawing from the database
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
        
        // When the image loads, draw it on the canvas
        img.onload = () => {
          clearCanvas();
          ctx.drawImage(img, 0, 0);
        };
        
        img.src = drawing.canvas_data;
        setCurrentDrawingId(drawingId);
        setMessage('Drawing loaded! 🎨');
      }
    } catch (error) {
      console.error('Error loading drawing:', error);
      setMessage('Error loading drawing');
    }
  };

  // ===== DRAWING FUNCTIONS =====
  // I learned that canvas is like a piece of paper we can draw on
  // These functions handle the actual drawing
  const startDrawing = (e) => {
    if (!user) {
      setMessage('Please sign in to start drawing!');
      return;
    }
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate where the mouse is on the canvas
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
      // Save each stroke to the database for collaboration
      const { error } = await supabase
        .from('drawing_strokes')
        .insert({
          drawing_id: currentDrawingId,
          user_id: user.id,
          x: Math.round(x),
          y: Math.round(y),
          color: currentColor,
          brush_size: brushSize
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving stroke:', error);
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
      
      // Save the drawing to the database
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
      console.error('Error saving drawing:', error);
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

  // Auto-hide messages after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ===== JSX RENDER =====
  // I learned that JSX is like HTML but with JavaScript superpowers
  // This is what the user sees on the screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Collaborative Drawing Board</h1>
                <p className="text-sm text-gray-500">
                  {user ? `Welcome, ${user.email}!` : 'Sign in to start drawing'}
                </p>
              </div>
            </div>
            
            {/* AUTHENTICATION BUTTONS */}
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={signIn}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              )}
              
              {user && (
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">
                    {user.email[0].toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* MESSAGE DISPLAY */}
          {message && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              {message}
            </div>
          )}
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* TOOLBAR SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
              
              {/* COLOR PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Colors</label>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setCurrentColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 ${
                        currentColor === color ? 'border-gray-800' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              {/* BRUSH SIZE SLIDER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
              </div>
            </div>
          </div>
          
          {/* DRAWING CANVAS */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <canvas
                ref={canvasRef}
                className="w-full h-[600px] border border-gray-200 rounded-lg cursor-crosshair"
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