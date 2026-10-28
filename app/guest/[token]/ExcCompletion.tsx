import styles from './ExpVideoPreview.module.css';
import portalStyles from './GuestPortal.module.css';
export type ExcDriver={name:string;orientationComplete:boolean};
/** Presentation only. Reservation qualification comes from authoritative readiness. */
export default function ExcCompletion({drivers,qualified}:{drivers:ExcDriver[];qualified:boolean}){
 const completed=drivers.filter(d=>d.orientationComplete);
 const showQualification=qualified&&drivers.length>0&&completed.length===drivers.length;
 if(!completed.length)return null;
 return <>
  {showQualification?<>
   <h3 className={styles.readyStatus}>Your party has qualified for our fastest check-out.</h3>
   <p>Your party has completed all required forms. Every driver has completed Utah's required OHV education course and our operator orientation.</p>
   <p>Please see an Adventure Tech upon arrival to complete your check-out.</p>
  </>:<p>The drivers listed below have completed our operator orientation.</p>}
  <div className={portalStyles.signerList} aria-label="Completed driver orientations">{completed.map(driver=><div className={portalStyles.signerRow} key={driver.name}>
   <div className={portalStyles.signerCheck} aria-hidden="true">✓</div>
   <div><strong>{driver.name}</strong><span className={styles.driverReady}>Orientation Complete</span></div>
  </div>)}</div>
  {showQualification?<aside className={styles.confidence} aria-label="Our Commitment to Your Confidence">
   <h3>Our Commitment to Your Confidence</h3>
   <p>Epic Xpress Checkout saves you time, but never at the expense of a confident departure. Our Adventure Techs are always happy to answer questions, review vehicle operation, or provide additional guidance before you head out.</p>
   <p><strong>Your adventure should begin with confidence, not uncertainty.</strong></p>
  </aside>:null}
 </>;
}
export function ExcOptionalInvitation({onChooseInPerson}:{onChooseInPerson?:()=>void}={}){return <div className={styles.optionalInvitation}>
 <h3>Prefer to complete your orientation with us?</h3>
 <p>Epic Xpress Checkout is entirely optional and designed to save you time at arrival. If you prefer, our Adventure Techs are happy to guide you through the orientation and knowledge assessment in person when you arrive.</p>
{onChooseInPerson?<button className={styles.inPersonLink} type="button" onClick={onChooseInPerson}>Complete Orientation In Person – Close this window</button>:null}</div>}

export function ExcOrientationIntro({id}:{id?:string}){return <div id={id}>
 <p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive. If you have multiple drivers, you can complete the orientation and knowledge check together as a group or individually.</p>
 <p>Allow approximately <strong>13 minutes</strong> now to save time at check-out and get on the trail sooner.</p>
</div>}
