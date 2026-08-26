import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}