import { NavLink } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';

export function MobileBottomNav() {
  return (
    <nav className={styles.bottomNav} aria-label="底部导航">
      <NavLink to="/" end className={styles.item}>
        首页
      </NavLink>
      <NavLink to="/heatmap" className={styles.item}>
        热力图
      </NavLink>
      <NavLink to="/scanner" className={styles.item}>
        扫描
      </NavLink>
      <NavLink to="/watchlist" className={styles.item}>
        自选
      </NavLink>
      <NavLink to="/settings" className={styles.item}>
        设置
      </NavLink>
    </nav>
  );
}

export default MobileBottomNav;
