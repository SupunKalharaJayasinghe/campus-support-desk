import { connectDB } from "@/lib/mongodb";
import {
  decryptPanOptional,
  getUrgentPaymentEncryptionKey,
} from "@/lib/community-urgent-card-payment-crypto";
import { CommunityUrgentCardPaymentModel } from "@/models/communityUrgentCardPayment";
import { UserModel } from "@/models/User";
import mongoose from "mongoose";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const adminUserId = toTrimmedString(searchParams.get("adminUserId"));
    const decrypt = searchParams.get("decrypt") === "1";

    if (!adminUserId || !mongoose.Types.ObjectId.isValid(adminUserId)) {
      return Response.json({ error: "Valid adminUserId is required" }, { status: 400 });
    }

    const admin = await UserModel.findOne({
      _id: adminUserId,
      role: "COMMUNITY_ADMIN",
      status: "ACTIVE",
    })
      .select("_id")
      .lean();

    if (!admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await CommunityUrgentCardPaymentModel.find({})
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    const key = getUrgentPaymentEncryptionKey();

    return Response.json({
      items: rows.map((row) => {
        const panEncrypted = typeof row.panEncrypted === "string" ? row.panEncrypted : null;
        return {
          id: String(row._id),
          status: row.status,
          amountRs: row.amountRs,
          urgentLevel: row.urgentLevel,
          userUsername: row.userUsername ?? "",
          userEmail: row.userEmail ?? "",
          displayName: row.displayName ?? "",
          cardMaskedDisplay: row.cardMaskedDisplay ?? "",
          cardLast4: row.cardLast4 ?? "",
          expiryMonth: row.expiryMonth,
          expiryYear: row.expiryYear,
          cvcVerified: Boolean(row.cvcVerified),
          cvcLength: row.cvcLength ?? null,
          panStoredEncrypted: Boolean(panEncrypted),
          cardNumberDecrypted:
            decrypt && panEncrypted && key ? decryptPanOptional(panEncrypted, key) : null,
          draftRef: row.draftRef ? String(row.draftRef) : null,
          postRef: row.postRef ? String(row.postRef) : null,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        };
      }),
      decryptionAvailable: Boolean(key),
    });
  } catch (e) {
    console.error("community-urgent-card-payments GET failed", e);
    return Response.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
