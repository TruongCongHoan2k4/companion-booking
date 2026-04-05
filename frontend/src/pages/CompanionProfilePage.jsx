import { Link } from 'react-router-dom';
import CompanionIdentityUpload from '../components/CompanionIdentityUpload.jsx';
import CompanionServicePrices from '../components/CompanionServicePrices.jsx';

export default function CompanionProfilePage() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <p className="mb-6 text-center text-sm text-slate-400">
        Yêu cầu đăng nhập tài khoản{' '}
        <span className="text-violet-300">COMPANION</span>.{' '}
        <Link to="/login" className="text-violet-400 underline">
          Đăng nhập
        </Link>
      </p>
      <CompanionIdentityUpload />
      <CompanionServicePrices />
    </div>
  );
}
