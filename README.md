# Data Command - Voice-Controlled Form Application

A responsive web application that allows users to fill out forms using voice commands. The application uses the Web Speech API for speech recognition and demonstrates how voice input can be processed for form data entry.

## Features

- **Voice-Controlled Form Filling**: Users can populate form fields (name, email, phone, address) using voice commands
- **Real-Time Microphone Access**: Continuous speech recognition for seamless voice input
- **Visual Feedback**: Active fields are highlighted during voice input
- **Form Submission via Voice**: Say "Submit" to submit the form
- **Responsive Design**: Works on various screen sizes

## Voice Commands

- "Add name as [Your Name]" - Fills the name field
- "Add email as [Your Email]" - Fills the email field
- "Add phone as [Your Phone]" - Fills the phone field
- "Add address as [Your Address]" - Fills the address field
- "Submit" - Submits the form

## Technical Details

This application is built with:

- **Next.js**: React framework for the frontend
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling
- **Web Speech API**: For voice recognition

## OpenAI Integration 

The application is designed to work with OpenAI's APIs for advanced voice processing:

- **Speech-to-Text**: Can be enhanced with Whisper API for more accurate transcription
- **Text Sanitization**: The code structure supports integration with GPT models for processing and sanitizing voice input

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Browser Compatibility

The Web Speech API is supported in most modern browsers, but implementation may vary. For best results, use Chrome or Edge.

## Future Enhancements

- Full OpenAI API integration for better voice processing
- Support for more complex form fields
- Multi-language support
- Voice feedback for user confirmation

## License

MIT 