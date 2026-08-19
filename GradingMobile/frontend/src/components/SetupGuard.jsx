import React from 'react';
import { Navigate } from 'react-router-dom';

const SetupGuard = ({ children }) => {
    const setupCompleted = localStorage.getItem('setup_completed');
    return setupCompleted ? <Navigate to="/" replace /> : children;
};

export default SetupGuard;
