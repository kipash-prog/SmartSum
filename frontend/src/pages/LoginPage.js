import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
`;

const FormCard = styled.div`
  background: white;
  padding: 2.5rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  animation: ${fadeIn} 0.5s ease-out;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
  }
`;

const Title = styled.h2`
  color: #333;
  text-align: center;
  margin-bottom: 2rem;
  font-size: 1.8rem;
`;

const InputField = styled.div`
  margin-bottom: 1.5rem;
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s;
  
  &:focus {
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2);
    outline: none;
  }
  
  &:hover {
    border-color: #bbb;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    background: #3a7bc8;
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post('http://localhost:8000/api/token/', { username, password });
      localStorage.setItem('token', res.data.access);
      navigate('/summarize');
    } catch (error) {
      setError('Invalid username or password. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <FormCard>
        <Title>Welcome Back</Title>
        <form onSubmit={handleSubmit}>
          <InputField>
            <Input
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </InputField>
          <InputField>
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </InputField>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <LoadingSpinner /> : 'Login'}
          </Button>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <div className="login-link">
            Don't have an account? <a href="/register">Register here</a>
          </div>
        </form>
      </FormCard>
    </Container>
  );
};

export default LoginPage;