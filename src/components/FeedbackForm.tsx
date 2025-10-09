import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './FeedbackForm.css';

export const FeedbackForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    howFound: '',
    workedWell: '',
    hadIssues: '',
    easeRating: '5',
    designRating: '5',
    wantToSee: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_key: 'ebfa8f9b-ca95-40f0-abeb-23155a5a0c9c',
          subject: 'SnapIT Burn Feedback',
          from_name: formData.email || 'Anonymous',
          message: `
How they found us: ${formData.howFound}

Did it work well? ${formData.workedWell}

Were there any issues? ${formData.hadIssues}

Ease of use (1-5): ${formData.easeRating}/5

Design rating (1-5): ${formData.designRating}/5

What else would you like to see?
${formData.wantToSee}

Email: ${formData.email || 'Not provided'}
          `.trim()
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert('Failed to submit feedback. Please try again or email us directly at snapitsoft@gmail.com');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert('Failed to submit feedback. Please email us directly at snapitsoft@gmail.com');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="feedback-container">
        <div className="feedback-success">
          <h1>Thank You! 🎉</h1>
          <p>Your feedback has been submitted successfully.</p>
          <p>We appreciate you taking the time to help us improve!</p>
          <button onClick={() => navigate('/')} className="home-btn">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-container">
      <h1>Send Feedback</h1>
      <p className="feedback-intro">
        Help us improve SnapIT Burn! Your feedback is valuable to us.
      </p>

      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="form-group">
          <label htmlFor="howFound">How did you find us? *</label>
          <input
            type="text"
            id="howFound"
            name="howFound"
            value={formData.howFound}
            onChange={handleChange}
            required
            placeholder="Search engine, social media, friend, etc."
          />
        </div>

        <div className="form-group">
          <label htmlFor="workedWell">Did it work well? *</label>
          <textarea
            id="workedWell"
            name="workedWell"
            value={formData.workedWell}
            onChange={handleChange}
            required
            rows={3}
            placeholder="Tell us about your experience"
          />
        </div>

        <div className="form-group">
          <label htmlFor="hadIssues">Were there any issues?</label>
          <textarea
            id="hadIssues"
            name="hadIssues"
            value={formData.hadIssues}
            onChange={handleChange}
            rows={3}
            placeholder="Describe any problems you encountered"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="easeRating">How easy was it to use? *</label>
            <select
              id="easeRating"
              name="easeRating"
              value={formData.easeRating}
              onChange={handleChange}
              required
            >
              <option value="5">5 - Very Easy</option>
              <option value="4">4 - Easy</option>
              <option value="3">3 - Moderate</option>
              <option value="2">2 - Difficult</option>
              <option value="1">1 - Very Difficult</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="designRating">Rate the design *</label>
            <select
              id="designRating"
              name="designRating"
              value={formData.designRating}
              onChange={handleChange}
              required
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Very Poor</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="wantToSee">What else would you like to see?</label>
          <textarea
            id="wantToSee"
            name="wantToSee"
            value={formData.wantToSee}
            onChange={handleChange}
            rows={4}
            placeholder="Suggest new features or improvements"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Your email (optional)</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your@email.com"
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={submitting} className="submit-btn">
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="cancel-btn">
            Cancel
          </button>
        </div>
      </form>

      <p className="direct-contact">
        Or email us directly at <a href="mailto:snapitsoft@gmail.com">snapitsoft@gmail.com</a>
      </p>
    </div>
  );
};
