import React, { useState, useRef, useEffect } from 'react';
import { Pencil, WineIcon as LineIcon, Square, Circle, Eraser, PaintBucket as Paintbucket, Undo2, Redo2, Save, FileImage } from 'lucide-react';

type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'fill';
type Action = {
  imageData: ImageData;
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<Tool>('pencil');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [actions, setActions] = useState<Action[]>([]);
  const [redoActions, setRedoActions] = useState<Action[]>([]);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);

  // Basic color palette
  const colors = [
    '#000000', '#808080', '#800000', '#808000', 
    '#008000', '#008080', '#000080', '#800080', 
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', 
    '#00ff00', '#00ffff', '#0000ff', '#ff00ff'
  ];

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setCtx(context);
        
        // Save initial blank canvas state
        const initialImageData = context.getImageData(0, 0, canvas.width, canvas.height);
        setActions([{ imageData: initialImageData }]);
      }
    }
  }, []);

  const saveCurrentState = () => {
    if (ctx && canvasRef.current) {
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setActions(prev => {
        // Keep only the last 5 actions
        const newActions = [...prev, { imageData }];
        if (newActions.length > 6) { // 6 because we include the initial blank state
          return newActions.slice(newActions.length - 6);
        }
        return newActions;
      });
      setRedoActions([]);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPos({ x, y });
    
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === 'eraser' ? 'white' : color;
      ctx.lineWidth = brushSize;
    } else if (tool === 'fill') {
      floodFill(x, y, color);
    }
    
    // Save the current state before drawing
    if (tool !== 'fill') {
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setCurrentImageData(imageData);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
      if (currentImageData) {
        // Restore the canvas to the state before drawing
        ctx.putImageData(currentImageData, 0, 0);
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        const width = x - startPos.x;
        const height = y - startPos.y;
        ctx.strokeRect(startPos.x, startPos.y, width, height);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing && tool !== 'fill') {
      saveCurrentState();
    }
    setIsDrawing(false);
  };

  const floodFill = (x: number, y: number, fillColor: string) => {
    if (!ctx || !canvasRef.current) return;
    
    // Save current state before filling
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCurrentImageData(imageData);
    
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    // Get the image data
    const data = imageData.data;
    
    // Convert the fill color to RGBA
    const fillColorRGB = hexToRgb(fillColor);
    if (!fillColorRGB) return;
    
    // Get the color of the pixel at the clicked position
    const targetColor = getPixelColor(data, x, y, width);
    
    // If the target color is the same as the fill color, return
    if (
      targetColor[0] === fillColorRGB.r &&
      targetColor[1] === fillColorRGB.g &&
      targetColor[2] === fillColorRGB.b
    ) {
      return;
    }
    
    // Perform flood fill
    const stack: [number, number][] = [[x, y]];
    while (stack.length > 0) {
      const [currX, currY] = stack.pop()!;
      
      // Check if the current pixel is within bounds and has the target color
      if (
        currX < 0 || currX >= width ||
        currY < 0 || currY >= height ||
        !matchesColor(data, currX, currY, targetColor, width)
      ) {
        continue;
      }
      
      // Set the color of the current pixel
      setPixelColor(data, currX, currY, fillColorRGB, width);
      
      // Add the neighboring pixels to the stack
      stack.push([currX + 1, currY]);
      stack.push([currX - 1, currY]);
      stack.push([currX, currY + 1]);
      stack.push([currX, currY - 1]);
    }
    
    // Update the canvas with the new image data
    ctx.putImageData(imageData, 0, 0);
    saveCurrentState();
  };

  const getPixelColor = (data: Uint8ClampedArray, x: number, y: number, width: number): [number, number, number, number] => {
    const index = (y * width + x) * 4;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  };

  const setPixelColor = (data: Uint8ClampedArray, x: number, y: number, color: { r: number; g: number; b: number }, width: number) => {
    const index = (y * width + x) * 4;
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
    data[index + 3] = 255; // Alpha
  };

  const matchesColor = (data: Uint8ClampedArray, x: number, y: number, targetColor: [number, number, number, number], width: number): boolean => {
    const index = (y * width + x) * 4;
    return (
      data[index] === targetColor[0] &&
      data[index + 1] === targetColor[1] &&
      data[index + 2] === targetColor[2] &&
      data[index + 3] === targetColor[3]
    );
  };

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const undo = () => {
    if (actions.length > 1) {
      const newActions = [...actions];
      const lastAction = newActions.pop();
      if (lastAction) {
        setRedoActions(prev => [...prev, lastAction]);
        const prevAction = newActions[newActions.length - 1];
        if (ctx && prevAction) {
          ctx.putImageData(prevAction.imageData, 0, 0);
          setActions(newActions);
        }
      }
    }
  };

  const redo = () => {
    if (redoActions.length > 0) {
      const newRedoActions = [...redoActions];
      const actionToRedo = newRedoActions.pop();
      if (actionToRedo && ctx) {
        ctx.putImageData(actionToRedo.imageData, 0, 0);
        setActions(prev => [...prev, actionToRedo]);
        setRedoActions(newRedoActions);
      }
    }
  };

  const saveImage = (format: 'png' | 'jpg') => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const dataURL = format === 'jpg' 
      ? canvas.toDataURL('image/jpeg', 0.8) 
      : canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `drawing.${format}`;
    link.href = dataURL;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Menu Bar */}
      <div className="bg-gray-200 p-2 flex items-center border-b border-gray-300">
        <div className="dropdown relative mr-4">
          <button className="px-3 py-1 hover:bg-gray-300 rounded">File</button>
          <div className="dropdown-content absolute hidden bg-white shadow-lg rounded mt-1 z-10">
            <button 
              className="block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center"
              onClick={() => saveImage('png')}
            >
              <Save size={16} className="mr-2" /> Save as PNG
            </button>
            <button 
              className="block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center"
              onClick={() => saveImage('jpg')}
            >
              <FileImage size={16} className="mr-2" /> Save as JPG
            </button>
          </div>
        </div>
        <div className="dropdown relative mr-4">
          <button className="px-3 py-1 hover:bg-gray-300 rounded">Edit</button>
          <div className="dropdown-content absolute hidden bg-white shadow-lg rounded mt-1 z-10">
            <button 
              className="block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center"
              onClick={undo}
              disabled={actions.length <= 1}
            >
              <Undo2 size={16} className="mr-2" /> Undo
            </button>
            <button 
              className="block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center"
              onClick={redo}
              disabled={redoActions.length === 0}
            >
              <Redo2 size={16} className="mr-2" /> Redo
            </button>
          </div>
        </div>
        <div className="dropdown relative">
          <button className="px-3 py-1 hover:bg-gray-300 rounded">Tools</button>
          <div className="dropdown-content absolute hidden bg-white shadow-lg rounded mt-1 z-10">
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'pencil' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('pencil')}
            >
              <Pencil size={16} className="mr-2" /> Pencil
            </button>
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'line' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('line')}
            >
              <LineIcon size={16} className="mr-2" /> Line
            </button>
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'rectangle' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('rectangle')}
            >
              <Square size={16} className="mr-2" /> Rectangle
            </button>
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'circle' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('circle')}
            >
              <Circle size={16} className="mr-2" /> Circle
            </button>
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'eraser' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('eraser')}
            >
              <Eraser size={16} className="mr-2" /> Eraser
            </button>
            <button 
              className={`block px-4 py-2 hover:bg-gray-100 w-full text-left flex items-center ${tool === 'fill' ? 'bg-blue-100' : ''}`}
              onClick={() => setTool('fill')}
            >
              <Paintbucket size={16} className="mr-2" /> Fill
            </button>
          </div>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="bg-gray-200 p-2 flex items-center border-b border-gray-300">
        <div className="flex space-x-2 mr-4">
          <button 
            className={`p-2 rounded ${tool === 'pencil' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('pencil')}
            title="Pencil"
          >
            <Pencil size={20} />
          </button>
          <button 
            className={`p-2 rounded ${tool === 'line' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('line')}
            title="Line"
          >
            <LineIcon size={20} />
          </button>
          <button 
            className={`p-2 rounded ${tool === 'rectangle' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('rectangle')}
            title="Rectangle"
          >
            <Square size={20} />
          </button>
          <button 
            className={`p-2 rounded ${tool === 'circle' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('circle')}
            title="Circle"
          >
            <Circle size={20} />
          </button>
          <button 
            className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            <Eraser size={20} />
          </button>
          <button 
            className={`p-2 rounded ${tool === 'fill' ? 'bg-blue-200' : 'hover:bg-gray-300'}`}
            onClick={() => setTool('fill')}
            title="Fill"
          >
            <Paintbucket size={20} />
          </button>
        </div>
        
        <div className="flex items-center mr-4">
          <span className="mr-2">Brush Size:</span>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))} 
            className="w-32"
          />
          <span className="ml-2">{brushSize}px</span>
        </div>
        
        <div className="flex items-center">
          <span className="mr-2">Color:</span>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            className="w-8 h-8 cursor-pointer"
          />
        </div>
        
        <div className="ml-auto flex space-x-2">
          <button 
            className="p-2 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={undo}
            disabled={actions.length <= 1}
            title="Undo"
          >
            <Undo2 size={20} />
          </button>
          <button 
            className="p-2 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={redo}
            disabled={redoActions.length === 0}
            title="Redo"
          >
            <Redo2 size={20} />
          </button>
        </div>
      </div>
      
      {/* Color Palette */}
      <div className="bg-gray-200 p-2 flex items-center border-b border-gray-300">
        <div className="flex flex-wrap">
          {colors.map((c, index) => (
            <div 
              key={index}
              className={`w-6 h-6 m-1 cursor-pointer border border-gray-400 ${color === c ? 'ring-2 ring-blue-500' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-300 p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="bg-white shadow-lg"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  );
}

export default App;