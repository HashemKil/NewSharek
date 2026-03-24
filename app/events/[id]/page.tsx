"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppNavbar from "../../../components/AppNavbar";
import { supabase } from "../../../lib/supabase";

type EventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
};

export default function EventDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      setEvent(data);
    };

    if (id) loadEvent();
  }, [id]);

  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/events">← Back</Link>

        {event && (
          <div className="bg-white p-8 rounded-xl mt-6">
            <h1 className="text-3xl font-bold text-[#1e3a8a]">
              {event.title}
            </h1>

            <p className="mt-4 text-gray-700">{event.description}</p>

            <p className="mt-4 text-sm text-gray-500">
              {event.location} • {event.date}
            </p>

            <button className="mt-6 bg-[#1e3a8a] text-white px-5 py-2 rounded-lg">
              Join Event
            </button>
          </div>
        )}
      </section>
    </main>
  );
}