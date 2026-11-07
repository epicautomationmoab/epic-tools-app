"use client";

import { useState } from "react";
import Customer360Modal from "../customer-360/Customer360Modal";

export default function PhoneReportC360Link({
  contactId,
  reservationId,
  reservationConfirmation,
  phone,
}:{
  contactId?:string|null;
  reservationId?:string|null;
  reservationConfirmation?:string|null;
  phone?:string|null;
}){
  const[open,setOpen]=useState(false);
  return <>
    <button
      type="button"
      onClick={()=>setOpen(true)}
      style={{border:0,background:"transparent",padding:0,fontSize:11,fontWeight:900,color:"#d84a1b",textDecoration:"underline",textUnderlineOffset:2,cursor:"pointer"}}
    >
      Open EpicC360 →
    </button>
    {open?<Customer360Modal
      open={true}
      onClose={()=>setOpen(false)}
      contactId={contactId||null}
      reservationId={reservationId||null}
      reservationConfirmation={reservationConfirmation||null}
      phone={phone||null}
    />:null}
  </>;
}
