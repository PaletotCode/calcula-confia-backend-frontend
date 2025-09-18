// Run this in your Next.js project to see available icons
import { icons } from "lucide-react";

console.log("Available Lucide icons:");
Object.keys(icons).forEach(iconName => {
  if (iconName.toLowerCase().includes('info') || 
      iconName.toLowerCase().includes('question') ||
      iconName.toLowerCase().includes('help')) {
    console.log(iconName);
  }
});
